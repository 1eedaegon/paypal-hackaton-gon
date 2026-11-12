use std::sync::Arc;

use sqlx::PgPool;

use crate::agent::gemini::Gemini;
use crate::config::Config;
use crate::paypal::PayPal;
use crate::rate_limit::RateLimiter;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub cfg: Arc<Config>,
    pub paypal: PayPal,
    pub gemini: Gemini,
    pub auth_limiter: Arc<RateLimiter>,
}
