use std::collections::HashMap;

use chrono::{DateTime, Utc};
use sqlx::types::Json;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::{
    InvoiceRow, STATUS_CANCELLED, STATUS_DRAFT, STATUS_PAID, STATUS_SENDING, STATUS_SENT,
};
use crate::paypal::invoicing::RemoteInvoice;
use crate::validation::ValidInvoice;

const COLUMNS: &str = "id, user_id, status, paypal_invoice_id, number, recipient_name, recipient_email, items, \
    total_cents, due_date, note, pay_url, reminder_count, last_reminded_at, created_at, sent_at, paid_at";

pub async fn find(db: &PgPool, user_id: Uuid, id: Uuid) -> AppResult<InvoiceRow> {
    sqlx::query_as(&format!(
        "SELECT {COLUMNS} FROM invoices WHERE id = $1 AND user_id = $2"
    ))
    .bind(id)
    .bind(user_id)
    .fetch_optional(db)
    .await?
    .ok_or(AppError::NotFound)
}

pub async fn list(db: &PgPool, user_id: Uuid) -> AppResult<Vec<InvoiceRow>> {
    let rows = sqlx::query_as(&format!(
        "SELECT {COLUMNS} FROM invoices WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500"
    ))
    .bind(user_id)
    .fetch_all(db)
    .await?;
    Ok(rows)
}

pub async fn find_by_paypal_id(
    db: &PgPool,
    paypal_invoice_id: &str,
) -> AppResult<Option<InvoiceRow>> {
    let row = sqlx::query_as(&format!(
        "SELECT {COLUMNS} FROM invoices WHERE paypal_invoice_id = $1"
    ))
    .bind(paypal_invoice_id)
    .fetch_optional(db)
    .await?;
    Ok(row)
}

/// Every invoice that is waiting for payment, across all users (for background reconciliation).
pub async fn list_all_unpaid(db: &PgPool) -> AppResult<Vec<InvoiceRow>> {
    let rows = sqlx::query_as(&format!(
        "SELECT {COLUMNS} FROM invoices WHERE status = $1 AND paypal_invoice_id IS NOT NULL"
    ))
    .bind(STATUS_SENT)
    .fetch_all(db)
    .await?;
    Ok(rows)
}

pub async fn insert_draft(
    db: &PgPool,
    user_id: Uuid,
    invoice: &ValidInvoice,
) -> AppResult<InvoiceRow> {
    let row = sqlx::query_as(&format!(
        "INSERT INTO invoices (id, user_id, status, recipient_name, recipient_email, items, total_cents, due_date, note) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING {COLUMNS}"
    ))
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(STATUS_DRAFT)
    .bind(&invoice.recipient_name)
    .bind(&invoice.recipient_email)
    .bind(Json(&invoice.items))
    .bind(invoice.total_cents)
    .bind(invoice.due_date)
    .bind(&invoice.note)
    .fetch_one(db)
    .await?;
    Ok(row)
}

pub async fn update_draft(
    db: &PgPool,
    user_id: Uuid,
    id: Uuid,
    invoice: &ValidInvoice,
) -> AppResult<InvoiceRow> {
    sqlx::query_as(&format!(
        "UPDATE invoices SET recipient_name = $1, recipient_email = $2, items = $3, total_cents = $4, \
         due_date = $5, note = $6 WHERE id = $7 AND user_id = $8 AND status = $9 RETURNING {COLUMNS}"
    ))
    .bind(&invoice.recipient_name)
    .bind(&invoice.recipient_email)
    .bind(Json(&invoice.items))
    .bind(invoice.total_cents)
    .bind(invoice.due_date)
    .bind(&invoice.note)
    .bind(id)
    .bind(user_id)
    .bind(STATUS_DRAFT)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| AppError::Conflict("Only drafts can be edited.".into()))
}

pub async fn delete_draft(db: &PgPool, user_id: Uuid, id: Uuid) -> AppResult<()> {
    let result = sqlx::query("DELETE FROM invoices WHERE id = $1 AND user_id = $2 AND status = $3")
        .bind(id)
        .bind(user_id)
        .bind(STATUS_DRAFT)
        .execute(db)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::Conflict("Only drafts can be discarded.".into()));
    }
    Ok(())
}

/// Moves a draft to `sending`. Returns the row only for the caller that won the claim.
pub async fn claim_for_sending(
    db: &PgPool,
    user_id: Uuid,
    id: Uuid,
) -> AppResult<Option<InvoiceRow>> {
    let row = sqlx::query_as(&format!(
        "UPDATE invoices SET status = $1, claimed_at = now() WHERE id = $2 AND user_id = $3 AND status = $4 RETURNING {COLUMNS}"
    ))
    .bind(STATUS_SENDING)
    .bind(id)
    .bind(user_id)
    .bind(STATUS_DRAFT)
    .fetch_optional(db)
    .await?;
    Ok(row)
}

pub async fn release_claim(db: &PgPool, id: Uuid) -> AppResult<()> {
    sqlx::query("UPDATE invoices SET status = $1 WHERE id = $2 AND status = $3")
        .bind(STATUS_DRAFT)
        .bind(id)
        .bind(STATUS_SENDING)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn mark_sent(
    db: &PgPool,
    id: Uuid,
    remote: &RemoteInvoice,
    sent_at: DateTime<Utc>,
) -> AppResult<InvoiceRow> {
    let row = sqlx::query_as(&format!(
        "UPDATE invoices SET status = $1, paypal_invoice_id = $2, number = $3, pay_url = $4, sent_at = $5 \
         WHERE id = $6 RETURNING {COLUMNS}"
    ))
    .bind(STATUS_SENT)
    .bind(&remote.id)
    .bind(&remote.number)
    .bind(&remote.pay_url)
    .bind(sent_at)
    .bind(id)
    .fetch_one(db)
    .await?;
    Ok(row)
}

/// Marks a sent invoice paid. Returns `None` when it was not in `sent` (already paid, cancelled...).
pub async fn mark_paid(db: &PgPool, id: Uuid) -> AppResult<Option<InvoiceRow>> {
    let row = sqlx::query_as(&format!(
        "UPDATE invoices SET status = $1, paid_at = now() WHERE id = $2 AND status = $3 RETURNING {COLUMNS}"
    ))
    .bind(STATUS_PAID)
    .bind(id)
    .bind(STATUS_SENT)
    .fetch_optional(db)
    .await?;
    Ok(row)
}

pub async fn mark_cancelled(db: &PgPool, id: Uuid) -> AppResult<Option<InvoiceRow>> {
    let row = sqlx::query_as(&format!(
        "UPDATE invoices SET status = $1 WHERE id = $2 AND status = $3 RETURNING {COLUMNS}"
    ))
    .bind(STATUS_CANCELLED)
    .bind(id)
    .bind(STATUS_SENT)
    .fetch_optional(db)
    .await?;
    Ok(row)
}

pub async fn record_reminder(db: &PgPool, id: Uuid) -> AppResult<()> {
    sqlx::query("UPDATE invoices SET reminder_count = reminder_count + 1, last_reminded_at = now() WHERE id = $1")
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

/// Paid invoice counts per client email, for "has this client paid before".
pub async fn paid_counts_by_client(db: &PgPool, user_id: Uuid) -> AppResult<HashMap<String, i64>> {
    let rows: Vec<(String, i64)> = sqlx::query_as(
        "SELECT recipient_email, COUNT(*) FROM invoices WHERE user_id = $1 AND status = $2 GROUP BY recipient_email",
    )
    .bind(user_id)
    .bind(STATUS_PAID)
    .fetch_all(db)
    .await?;
    Ok(rows.into_iter().collect())
}

pub async fn count_drafts(db: &PgPool, user_id: Uuid) -> AppResult<i64> {
    let (count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM invoices WHERE user_id = $1 AND status = $2")
            .bind(user_id)
            .bind(STATUS_DRAFT)
            .fetch_one(db)
            .await?;
    Ok(count)
}

/// Returns claims abandoned mid-flight (crash, dropped connection) to a state the user can act on.
pub async fn release_stale_claims(db: &PgPool) -> AppResult<u64> {
    let result = sqlx::query(
        "UPDATE invoices SET status = $1 WHERE status = $2 AND claimed_at < now() - interval '5 minutes'",
    )
    .bind(STATUS_DRAFT)
    .bind(STATUS_SENDING)
    .execute(db)
    .await?;
    Ok(result.rows_affected())
}
