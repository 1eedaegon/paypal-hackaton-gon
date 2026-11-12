//! Database access. Every query is scoped by `user_id` unless it serves a PayPal callback.

pub mod actions;
pub mod activity;
pub mod invoices;
pub mod policy;
pub mod usage;

use sqlx::PgPool;

const SCHEMA: &str = include_str!("../../schema.sql");

/// Creates tables that do not exist yet. The schema file is idempotent.
pub async fn migrate(db: &PgPool) -> anyhow::Result<()> {
    sqlx::raw_sql(SCHEMA).execute(db).await?;
    Ok(())
}
