use chrono::{Duration, Utc};
use uuid::Uuid;

use super::describe;
use crate::error::{AppError, AppResult};
use crate::models::{
    Effect, InvoiceRow, ACTION_EXECUTED, ACTION_PENDING, ACTION_REJECTED, ACTION_REMIND, ACTION_SUPERSEDED,
    ACTION_WAIT, STATUS_SENT,
};
use crate::repo::actions::{NewAction, ACTION_EXECUTING};
use crate::repo::activity::ACTOR_AGENT;
use crate::repo::{actions, activity, invoices};
use crate::state::AppState;
use crate::validation::required_text;

pub const MAX_SUBJECT_LEN: usize = 200;
pub const MAX_MESSAGE_LEN: usize = 2000;
const MAX_REASONING_LEN: usize = 1000;
const MAX_REMINDERS_PER_INVOICE: i32 = 6;
const REMINDER_COOLDOWN_HOURS: i64 = 20;

/// A follow-up the agent wants to take on one invoice.
pub struct Proposal {
    pub invoice_id: Uuid,
    pub kind: String,
    pub subject: String,
    pub message: String,
    pub reasoning: String,
}

/// Stores the agent's decision. Reminders wait for approval unless `auto_send` is on.
pub async fn propose(
    state: &AppState,
    user_id: Uuid,
    proposal: &Proposal,
    auto_send: bool,
) -> AppResult<Effect> {
    let invoice = invoices::find(&state.db, user_id, proposal.invoice_id).await?;
    if invoice.status != STATUS_SENT {
        return Err(AppError::invalid(
            "That invoice is not awaiting payment, so no follow-up is needed.",
        ));
    }
    let reasoning = required_text(&proposal.reasoning, "Reasoning", MAX_REASONING_LEN)?;
    actions::supersede_pending(&state.db, invoice.id).await?;

    if proposal.kind == ACTION_WAIT {
        let new = NewAction {
            user_id,
            invoice_id: invoice.id,
            kind: ACTION_WAIT,
            subject: "",
            message: "",
            reasoning: &reasoning,
            status: ACTION_EXECUTED,
        };
        let action_id = actions::insert(&state.db, &new).await?;
        let summary = format!(
            "Decided to wait on invoice {}: {reasoning}",
            describe(&invoice)
        );
        activity::log(
            &state.db,
            user_id,
            Some(invoice.id),
            ACTOR_AGENT,
            "decision_wait",
            &summary,
        )
        .await?;
        return Ok(Effect::ActionProposed { action_id });
    }
    if proposal.kind != ACTION_REMIND {
        return Err(AppError::invalid(
            "decision must be \"remind\" or \"wait\".",
        ));
    }

    let subject = required_text(&proposal.subject, "Subject", MAX_SUBJECT_LEN)?;
    let message = required_text(&proposal.message, "Message", MAX_MESSAGE_LEN)?;
    let new = NewAction {
        user_id,
        invoice_id: invoice.id,
        kind: ACTION_REMIND,
        subject: &subject,
        message: &message,
        reasoning: &reasoning,
        status: ACTION_PENDING,
    };
    let action_id = actions::insert(&state.db, &new).await?;
    let summary = format!(
        "Drafted a reminder for invoice {}: {reasoning}",
        describe(&invoice)
    );
    activity::log(
        &state.db,
        user_id,
        Some(invoice.id),
        ACTOR_AGENT,
        "reminder_proposed",
        &summary,
    )
    .await?;

    if auto_send
        && execute(state, user_id, action_id, ACTOR_AGENT)
            .await
            .is_ok()
    {
        return Ok(Effect::ActionExecuted { action_id });
    }
    Ok(Effect::ActionProposed { action_id })
}

/// Hard limits on contacting a client, whatever the policy text or the model says.
fn ensure_reminder_allowed(invoice: &InvoiceRow) -> AppResult<()> {
    if invoice.reminder_count >= MAX_REMINDERS_PER_INVOICE {
        return Err(AppError::Conflict(format!(
            "This invoice already had {MAX_REMINDERS_PER_INVOICE} reminders, which is the maximum."
        )));
    }
    let cooldown = Duration::hours(REMINDER_COOLDOWN_HOURS);
    if invoice
        .last_reminded_at
        .is_some_and(|at| Utc::now() - at < cooldown)
    {
        return Err(AppError::Conflict(format!(
            "A reminder for this invoice already went out in the last {REMINDER_COOLDOWN_HOURS} hours."
        )));
    }
    Ok(())
}

/// Sends a pending reminder through PayPal exactly once. On failure it stays pending with the error attached.
pub async fn execute(
    state: &AppState,
    user_id: Uuid,
    action_id: Uuid,
    actor: &str,
) -> AppResult<()> {
    let action = actions::find(&state.db, user_id, action_id).await?;
    if action.kind != ACTION_REMIND {
        return Err(AppError::Conflict(
            "This decision has nothing to send.".into(),
        ));
    }
    let before = invoices::find(&state.db, user_id, action.invoice_id).await?;
    ensure_reminder_allowed(&before)?;
    if !actions::claim_for_execution(&state.db, user_id, action_id).await? {
        return Err(AppError::Conflict(
            "This reminder was already handled.".into(),
        ));
    }
    let invoice = invoices::find(&state.db, user_id, action.invoice_id).await?;
    let paypal_id = match (
        invoice.status.as_str(),
        invoice.paypal_invoice_id.as_deref(),
    ) {
        (STATUS_SENT, Some(paypal_id)) => paypal_id,
        _ => {
            actions::transition(
                &state.db,
                action_id,
                ACTION_EXECUTING,
                ACTION_SUPERSEDED,
                None,
            )
            .await?;
            return Err(AppError::Conflict(
                "This invoice is no longer awaiting payment.".into(),
            ));
        }
    };
    if let Err(err) = state
        .paypal
        .remind_invoice(paypal_id, &action.subject, &action.message)
        .await
    {
        let reason = err.to_string();
        actions::transition(
            &state.db,
            action_id,
            ACTION_EXECUTING,
            ACTION_PENDING,
            Some(&reason),
        )
        .await?;
        return Err(err);
    }
    actions::transition(
        &state.db,
        action_id,
        ACTION_EXECUTING,
        ACTION_EXECUTED,
        None,
    )
    .await?;
    invoices::record_reminder(&state.db, invoice.id).await?;
    let summary = format!(
        "Sent a PayPal reminder for invoice {}: \"{}\"",
        describe(&invoice),
        action.subject
    );
    activity::log(
        &state.db,
        user_id,
        Some(invoice.id),
        actor,
        "reminder_sent",
        &summary,
    )
    .await
}

pub async fn reject(state: &AppState, user_id: Uuid, action_id: Uuid) -> AppResult<()> {
    let action = actions::find(&state.db, user_id, action_id).await?;
    if !actions::transition(&state.db, action_id, ACTION_PENDING, ACTION_REJECTED, None).await? {
        return Err(AppError::Conflict(
            "This reminder was already handled.".into(),
        ));
    }
    let summary = format!(
        "Rejected the proposed reminder to {}",
        action.invoice_recipient_name
    );
    activity::log(
        &state.db,
        user_id,
        Some(action.invoice_id),
        "user",
        "reminder_rejected",
        &summary,
    )
    .await
}

pub async fn edit(
    state: &AppState,
    user_id: Uuid,
    action_id: Uuid,
    subject: &str,
    message: &str,
) -> AppResult<()> {
    let subject = required_text(subject, "Subject", MAX_SUBJECT_LEN)?;
    let message = required_text(message, "Message", MAX_MESSAGE_LEN)?;
    actions::update_text(&state.db, user_id, action_id, &subject, &message).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::types::Json;

    fn sent_invoice(reminder_count: i32, last_reminded_hours_ago: Option<i64>) -> InvoiceRow {
        InvoiceRow {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            status: STATUS_SENT.into(),
            paypal_invoice_id: Some("INV2-TEST".into()),
            number: Some("0001".into()),
            recipient_name: "Client".into(),
            recipient_email: "c@example.com".into(),
            items: Json(vec![]),
            total_cents: 10_000,
            due_date: Utc::now().date_naive(),
            note: String::new(),
            pay_url: None,
            reminder_count,
            last_reminded_at: last_reminded_hours_ago.map(|hours| Utc::now() - Duration::hours(hours)),
            created_at: Utc::now(),
            sent_at: None,
            paid_at: None,
        }
    }

    #[test]
    fn allows_first_reminder_and_one_after_the_cooldown() {
        assert!(ensure_reminder_allowed(&sent_invoice(0, None)).is_ok());
        assert!(ensure_reminder_allowed(&sent_invoice(1, Some(REMINDER_COOLDOWN_HOURS + 1))).is_ok());
    }

    #[test]
    fn blocks_reminder_inside_the_cooldown() {
        assert!(ensure_reminder_allowed(&sent_invoice(1, Some(1))).is_err());
    }

    #[test]
    fn blocks_reminder_past_the_per_invoice_maximum() {
        assert!(ensure_reminder_allowed(&sent_invoice(MAX_REMINDERS_PER_INVOICE, Some(100))).is_err());
    }
}
