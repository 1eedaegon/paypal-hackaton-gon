use uuid::Uuid;

use super::describe;
use crate::error::{AppError, AppResult};
use crate::models::{
    Effect, ACTION_EXECUTED, ACTION_PENDING, ACTION_REJECTED, ACTION_REMIND, ACTION_SUPERSEDED,
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
