use std::collections::HashMap;

use chrono::{NaiveDate, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use super::{describe, today};
use crate::error::{AppError, AppResult};
use crate::models::{InvoiceRow, User, STATUS_CANCELLED, STATUS_PAID, STATUS_SENT};
use crate::paypal::invoicing::{local_status, NewInvoice, RemoteInvoice};
use crate::repo::activity::{ACTOR_PAYPAL, ACTOR_USER};
use crate::repo::{actions, activity, invoices, usage};
use crate::state::AppState;

/// Creates the invoice in PayPal and sends it. A failed send leaves no PayPal draft behind.
pub async fn deliver(
    state: &AppState,
    invoicer_name: &str,
    invoice: &InvoiceRow,
    invoice_date: NaiveDate,
) -> AppResult<RemoteInvoice> {
    let remote = state
        .paypal
        .create_invoice(&NewInvoice {
            invoicer_name,
            recipient_name: &invoice.recipient_name,
            recipient_email: &invoice.recipient_email,
            items: &invoice.items.0,
            invoice_date,
            due_date: invoice.due_date,
            note: &invoice.note,
        })
        .await?;
    if let Err(send_error) = state.paypal.send_invoice(&remote.id).await {
        if let Err(cleanup_error) = state.paypal.delete_invoice(&remote.id).await {
            tracing::warn!(error = %cleanup_error, paypal_invoice_id = %remote.id, "could not delete unsent PayPal draft");
        }
        return Err(send_error);
    }
    Ok(remote)
}

/// Approves a draft: it is created and sent through PayPal exactly once.
pub async fn send(state: &AppState, user: &User, id: Uuid) -> AppResult<InvoiceRow> {
    let Some(claimed) = invoices::claim_for_sending(&state.db, user.id, id).await? else {
        invoices::find(&state.db, user.id, id).await?;
        return Err(AppError::Conflict(
            "This invoice has already been sent.".into(),
        ));
    };
    let delivered = match usage::consume_invoice_sends(&state.db, &state.cfg, user.id, 1).await {
        Ok(()) => deliver(state, &user.name, &claimed, today()).await,
        Err(quota_error) => Err(quota_error),
    };
    let remote = match delivered {
        Ok(remote) => remote,
        Err(err) => {
            invoices::release_claim(&state.db, id).await?;
            return Err(err);
        }
    };
    let sent = invoices::mark_sent(&state.db, id, &remote, Utc::now()).await?;
    let summary = format!(
        "Approved and sent invoice {} through PayPal",
        describe(&sent)
    );
    activity::log(
        &state.db,
        user.id,
        Some(id),
        ACTOR_USER,
        "invoice_sent",
        &summary,
    )
    .await?;
    Ok(sent)
}

fn require_unpaid(invoice: &InvoiceRow) -> AppResult<&str> {
    match (
        invoice.status.as_str(),
        invoice.paypal_invoice_id.as_deref(),
    ) {
        (STATUS_SENT, Some(paypal_id)) => Ok(paypal_id),
        _ => Err(AppError::Conflict(
            "This invoice is not awaiting payment.".into(),
        )),
    }
}

/// Records a payment the user received outside PayPal and closes the invoice.
pub async fn record_payment(state: &AppState, user: &User, id: Uuid) -> AppResult<InvoiceRow> {
    let invoice = invoices::find(&state.db, user.id, id).await?;
    let paypal_id = require_unpaid(&invoice)?;
    state
        .paypal
        .record_payment(paypal_id, invoice.total_cents, today())
        .await?;
    let summary = format!(
        "Recorded an outside payment for invoice {}",
        describe(&invoice)
    );
    settle_paid(
        &state.db,
        &invoice,
        ACTOR_USER,
        "payment_recorded",
        &summary,
    )
    .await?;
    invoices::find(&state.db, user.id, id).await
}

async fn settle_paid(
    db: &PgPool,
    invoice: &InvoiceRow,
    actor: &str,
    kind: &str,
    summary: &str,
) -> AppResult<()> {
    if invoices::mark_paid(db, invoice.id).await?.is_none() {
        return Ok(());
    }
    actions::supersede_pending(db, invoice.id).await?;
    activity::log(db, invoice.user_id, Some(invoice.id), actor, kind, summary).await
}

async fn settle_cancelled(db: &PgPool, invoice: &InvoiceRow) -> AppResult<()> {
    if invoices::mark_cancelled(db, invoice.id).await?.is_none() {
        return Ok(());
    }
    actions::supersede_pending(db, invoice.id).await?;
    let summary = format!(
        "Invoice {} was cancelled or refunded in PayPal",
        describe(invoice)
    );
    activity::log(
        db,
        invoice.user_id,
        Some(invoice.id),
        ACTOR_PAYPAL,
        "invoice_cancelled",
        &summary,
    )
    .await
}

/// Brings a local invoice in line with the status PayPal reports for it.
pub async fn apply_remote_status(
    db: &PgPool,
    invoice: &InvoiceRow,
    paypal_status: &str,
) -> AppResult<()> {
    if invoice.status != STATUS_SENT {
        return Ok(());
    }
    match local_status(paypal_status) {
        Some(STATUS_PAID) => {
            let summary = format!("Payment received for invoice {}", describe(invoice));
            settle_paid(db, invoice, ACTOR_PAYPAL, "payment_received", &summary).await
        }
        Some(STATUS_CANCELLED) => settle_cancelled(db, invoice).await,
        _ => Ok(()),
    }
}

/// Re-reads one invoice from PayPal (the source of truth for payment status).
pub async fn sync(state: &AppState, user: &User, id: Uuid) -> AppResult<InvoiceRow> {
    let invoice = invoices::find(&state.db, user.id, id).await?;
    if let Some(paypal_id) = invoice.paypal_invoice_id.as_deref() {
        let remote = state.paypal.get_invoice(paypal_id).await?;
        apply_remote_status(&state.db, &invoice, &remote.status).await?;
    }
    invoices::find(&state.db, user.id, id).await
}

/// Handles a PayPal webhook for one invoice by re-reading it from PayPal.
pub async fn sync_by_paypal_id(state: &AppState, paypal_invoice_id: &str) -> AppResult<()> {
    let Some(invoice) = invoices::find_by_paypal_id(&state.db, paypal_invoice_id).await? else {
        return Ok(());
    };
    let remote = state.paypal.get_invoice(paypal_invoice_id).await?;
    apply_remote_status(&state.db, &invoice, &remote.status).await
}

/// Safety net for missed webhooks: compares every unpaid invoice with PayPal's list.
pub async fn reconcile_all(state: &AppState) -> AppResult<()> {
    let unpaid = invoices::list_all_unpaid(&state.db).await?;
    if unpaid.is_empty() {
        return Ok(());
    }
    let statuses: HashMap<String, String> = state
        .paypal
        .list_recent_statuses()
        .await?
        .into_iter()
        .collect();
    for invoice in &unpaid {
        let remote_status = invoice
            .paypal_invoice_id
            .as_ref()
            .and_then(|id| statuses.get(id));
        if let Some(status) = remote_status {
            apply_remote_status(&state.db, invoice, status).await?;
        }
    }
    Ok(())
}
