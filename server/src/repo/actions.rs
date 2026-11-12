use sqlx::PgPool;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::{ActionRow, ACTION_EXECUTED, ACTION_PENDING, ACTION_REMIND, ACTION_SUPERSEDED};

/// Transient status while the PayPal reminder call is in flight, so an action is never executed twice.
pub const ACTION_EXECUTING: &str = "executing";

const SELECT: &str = "SELECT a.id, a.invoice_id, a.kind, a.subject, a.message, a.reasoning, a.status, a.error, \
    a.created_at, a.executed_at, i.number AS invoice_number, i.recipient_name AS invoice_recipient_name, \
    i.total_cents AS invoice_total_cents, i.due_date AS invoice_due_date, i.status AS invoice_status \
    FROM actions a JOIN invoices i ON i.id = a.invoice_id";

pub struct NewAction<'a> {
    pub user_id: Uuid,
    pub invoice_id: Uuid,
    pub kind: &'a str,
    pub subject: &'a str,
    pub message: &'a str,
    pub reasoning: &'a str,
    pub status: &'a str,
}

pub async fn find(db: &PgPool, user_id: Uuid, id: Uuid) -> AppResult<ActionRow> {
    sqlx::query_as(&format!("{SELECT} WHERE a.id = $1 AND a.user_id = $2"))
        .bind(id)
        .bind(user_id)
        .fetch_optional(db)
        .await?
        .ok_or(AppError::NotFound)
}

pub async fn list(
    db: &PgPool,
    user_id: Uuid,
    status: Option<&str>,
    limit: i64,
) -> AppResult<Vec<ActionRow>> {
    let rows = sqlx::query_as(&format!(
        "{SELECT} WHERE a.user_id = $1 AND ($2::text IS NULL OR a.status = $2) AND a.status <> $3 \
         ORDER BY a.created_at DESC LIMIT $4"
    ))
    .bind(user_id)
    .bind(status)
    .bind(ACTION_SUPERSEDED)
    .bind(limit)
    .fetch_all(db)
    .await?;
    Ok(rows)
}

pub async fn list_for_invoice(
    db: &PgPool,
    user_id: Uuid,
    invoice_id: Uuid,
) -> AppResult<Vec<ActionRow>> {
    let rows = sqlx::query_as(&format!(
        "{SELECT} WHERE a.user_id = $1 AND a.invoice_id = $2 AND a.status <> $3 ORDER BY a.created_at DESC LIMIT 50"
    ))
    .bind(user_id)
    .bind(invoice_id)
    .bind(ACTION_SUPERSEDED)
    .fetch_all(db)
    .await?;
    Ok(rows)
}

pub async fn insert(db: &PgPool, action: &NewAction<'_>) -> AppResult<Uuid> {
    let id = Uuid::new_v4();
    let executed = action.status == ACTION_EXECUTED;
    sqlx::query(
        "INSERT INTO actions (id, user_id, invoice_id, kind, subject, message, reasoning, status, executed_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $9 THEN now() ELSE NULL END)",
    )
    .bind(id)
    .bind(action.user_id)
    .bind(action.invoice_id)
    .bind(action.kind)
    .bind(action.subject)
    .bind(action.message)
    .bind(action.reasoning)
    .bind(action.status)
    .bind(executed)
    .execute(db)
    .await?;
    Ok(id)
}

/// A new proposal replaces any proposal still waiting for the same invoice.
pub async fn supersede_pending(db: &PgPool, invoice_id: Uuid) -> AppResult<()> {
    sqlx::query("UPDATE actions SET status = $1 WHERE invoice_id = $2 AND status = $3")
        .bind(ACTION_SUPERSEDED)
        .bind(invoice_id)
        .bind(ACTION_PENDING)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn update_text(
    db: &PgPool,
    user_id: Uuid,
    id: Uuid,
    subject: &str,
    message: &str,
) -> AppResult<()> {
    let result = sqlx::query(
        "UPDATE actions SET subject = $1, message = $2 WHERE id = $3 AND user_id = $4 AND status = $5 AND kind = $6",
    )
    .bind(subject)
    .bind(message)
    .bind(id)
    .bind(user_id)
    .bind(ACTION_PENDING)
    .bind(ACTION_REMIND)
    .execute(db)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::Conflict(
            "Only pending reminders can be edited.".into(),
        ));
    }
    Ok(())
}

/// Moves a pending action to `executing`. Returns false when someone else already handled it.
pub async fn claim_for_execution(db: &PgPool, user_id: Uuid, id: Uuid) -> AppResult<bool> {
    let result = sqlx::query(
        "UPDATE actions SET status = $1, claimed_at = now() WHERE id = $2 AND user_id = $3 AND status = $4",
    )
    .bind(ACTION_EXECUTING)
    .bind(id)
    .bind(user_id)
    .bind(ACTION_PENDING)
    .execute(db)
    .await?;
    Ok(result.rows_affected() == 1)
}

/// Sets the final status of an action from a required current status.
pub async fn transition(
    db: &PgPool,
    id: Uuid,
    from: &str,
    to: &str,
    error: Option<&str>,
) -> AppResult<bool> {
    let result = sqlx::query(
        "UPDATE actions SET status = $1, error = $2, \
         executed_at = CASE WHEN $1 = $3 THEN now() ELSE executed_at END WHERE id = $4 AND status = $5",
    )
    .bind(to)
    .bind(error)
    .bind(ACTION_EXECUTED)
    .bind(id)
    .bind(from)
    .execute(db)
    .await?;
    Ok(result.rows_affected() == 1)
}

/// Returns reminders abandoned mid-send (crash, dropped connection) to the approvals inbox.
pub async fn release_stale_claims(db: &PgPool) -> AppResult<u64> {
    let result = sqlx::query(
        "UPDATE actions SET status = $1 WHERE status = $2 AND claimed_at < now() - interval '5 minutes'",
    )
    .bind(ACTION_PENDING)
    .bind(ACTION_EXECUTING)
    .execute(db)
    .await?;
    Ok(result.rows_affected())
}
