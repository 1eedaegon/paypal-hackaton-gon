use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppResult;
use crate::models::Policy;

pub async fn get(db: &PgPool, user_id: Uuid) -> AppResult<Policy> {
    let policy =
        sqlx::query_as("SELECT text, auto_send, updated_at FROM policies WHERE user_id = $1")
            .bind(user_id)
            .fetch_optional(db)
            .await?
            .unwrap_or(Policy {
                text: String::new(),
                auto_send: false,
                updated_at: None,
            });
    Ok(policy)
}

pub async fn upsert(db: &PgPool, user_id: Uuid, text: &str, auto_send: bool) -> AppResult<Policy> {
    let policy = sqlx::query_as(
        "INSERT INTO policies (user_id, text, auto_send, updated_at) VALUES ($1, $2, $3, now()) \
         ON CONFLICT (user_id) DO UPDATE SET text = EXCLUDED.text, auto_send = EXCLUDED.auto_send, updated_at = now() \
         RETURNING text, auto_send, updated_at",
    )
    .bind(user_id)
    .bind(text)
    .bind(auto_send)
    .fetch_one(db)
    .await?;
    Ok(policy)
}
