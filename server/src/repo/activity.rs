use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppResult;
use crate::models::Activity;

pub const ACTOR_AGENT: &str = "agent";
pub const ACTOR_USER: &str = "user";
pub const ACTOR_PAYPAL: &str = "paypal";
pub const ACTOR_SYSTEM: &str = "system";

const COLUMNS: &str = "id, invoice_id, actor, kind, summary, created_at";

pub async fn log(
    db: &PgPool,
    user_id: Uuid,
    invoice_id: Option<Uuid>,
    actor: &str,
    kind: &str,
    summary: &str,
) -> AppResult<()> {
    sqlx::query("INSERT INTO activity (id, user_id, invoice_id, actor, kind, summary) VALUES ($1, $2, $3, $4, $5, $6)")
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(invoice_id)
        .bind(actor)
        .bind(kind)
        .bind(summary)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn list(db: &PgPool, user_id: Uuid, limit: i64) -> AppResult<Vec<Activity>> {
    let rows = sqlx::query_as(&format!(
        "SELECT {COLUMNS} FROM activity WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2"
    ))
    .bind(user_id)
    .bind(limit)
    .fetch_all(db)
    .await?;
    Ok(rows)
}

pub async fn list_for_invoice(
    db: &PgPool,
    user_id: Uuid,
    invoice_id: Uuid,
) -> AppResult<Vec<Activity>> {
    let rows = sqlx::query_as(&format!(
        "SELECT {COLUMNS} FROM activity WHERE user_id = $1 AND invoice_id = $2 ORDER BY created_at DESC LIMIT 100"
    ))
    .bind(user_id)
    .bind(invoice_id)
    .fetch_all(db)
    .await?;
    Ok(rows)
}
