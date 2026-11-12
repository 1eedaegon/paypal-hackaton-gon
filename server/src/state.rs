use std::sync::Arc;

use sqlx::PgPool;
use tokio::sync::Semaphore;

use crate::agent::gemini::Gemini;
use crate::config::Config;
use crate::paypal::PayPal;
use crate::rate_limit::RateLimiter;

/// Request throttles. Keys are client addresses for the auth ones and user ids for `paypal`.
pub struct Limiters {
    pub signup: RateLimiter,
    pub login: RateLimiter,
    /// Endpoints that call PayPal directly without a daily quota (sync, approve, record payment).
    pub paypal: RateLimiter,
    pub webhook: RateLimiter,
    /// Bounds concurrent Argon2 work, which is memory heavy.
    pub password_hashing: Semaphore,
}

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub cfg: Arc<Config>,
    pub paypal: PayPal,
    pub gemini: Gemini,
    pub limiters: Arc<Limiters>,
}
