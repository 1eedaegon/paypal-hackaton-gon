//! Daily quotas. They keep a public demo from burning through the shared LLM key and PayPal sandbox.

use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::error::{AppError, AppResult};

pub async fn agent_calls_today(db: &PgPool, user_id: Uuid) -> AppResult<i32> {
    let row: Option<(i32,)> =
        sqlx::query_as("SELECT agent_calls FROM usage WHERE user_id = $1 AND day = CURRENT_DATE")
            .bind(user_id)
            .fetch_optional(db)
            .await?;
    Ok(row.map_or(0, |(calls,)| calls))
}

/// Counts one agent run against the user's and the global daily budget, or fails with `quota_exceeded`.
pub async fn consume_agent_call(db: &PgPool, cfg: &Config, user_id: Uuid) -> AppResult<()> {
    let (global,): (i64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(agent_calls), 0)::bigint FROM usage WHERE day = CURRENT_DATE",
    )
    .fetch_one(db)
    .await?;
    if global >= cfg.global_agent_daily_limit {
        return Err(AppError::Quota(
            "The demo has reached its shared daily AI budget. It resets at midnight UTC.".into(),
        ));
    }
    let consumed: Option<(i32,)> = sqlx::query_as(
        "INSERT INTO usage (user_id, day, agent_calls) VALUES ($1, CURRENT_DATE, 1) \
         ON CONFLICT (user_id, day) DO UPDATE SET agent_calls = usage.agent_calls + 1 \
         WHERE usage.agent_calls < $2 RETURNING agent_calls",
    )
    .bind(user_id)
    .bind(cfg.agent_daily_limit)
    .fetch_optional(db)
    .await?;
    consumed.map(|_| ()).ok_or_else(|| {
        AppError::Quota(format!(
            "You have used all {} agent runs for today. The limit resets at midnight UTC.",
            cfg.agent_daily_limit
        ))
    })
}

/// Counts `count` invoices against the user's daily sending budget.
pub async fn consume_invoice_sends(
    db: &PgPool,
    cfg: &Config,
    user_id: Uuid,
    count: i32,
) -> AppResult<()> {
    let consumed: Option<(i32,)> = sqlx::query_as(
        "INSERT INTO usage (user_id, day, invoices_sent) VALUES ($1, CURRENT_DATE, $2) \
         ON CONFLICT (user_id, day) DO UPDATE SET invoices_sent = usage.invoices_sent + $2 \
         WHERE usage.invoices_sent + $2 <= $3 RETURNING invoices_sent",
    )
    .bind(user_id)
    .bind(count)
    .bind(cfg.invoice_daily_limit)
    .fetch_optional(db)
    .await?;
    consumed.map(|_| ()).ok_or_else(|| {
        AppError::Quota(format!(
            "You can send up to {} invoices per day in this demo. The limit resets at midnight UTC.",
            cfg.invoice_daily_limit
        ))
    })
}
