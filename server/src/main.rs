mod agent;
mod api;
mod auth;
mod config;
mod error;
mod models;
mod money;
mod paypal;
mod rate_limit;
mod repo;
mod security;
mod service;
mod state;
mod validation;

use std::net::SocketAddr;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use anyhow::Context;
use axum::middleware;
use axum::Router;
use sqlx::postgres::PgPoolOptions;
use tokio::sync::Semaphore;
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;

use crate::agent::gemini::Gemini;
use crate::config::Config;
use crate::error::AppError;
use crate::paypal::PayPal;
use crate::rate_limit::RateLimiter;
use crate::state::{AppState, Limiters};

const MAX_BODY_BYTES: usize = 256 * 1024;
const DB_MAX_CONNECTIONS: u32 = 8;
const MINUTE: Duration = Duration::from_secs(60);
const TEN_MINUTES: Duration = Duration::from_secs(10 * 60);
const HOUR: Duration = Duration::from_secs(60 * 60);
const SIGNUPS_PER_HOUR: u32 = 6;
const LOGINS_PER_TEN_MINUTES: u32 = 30;
const PAYPAL_CALLS_PER_MINUTE: u32 = 30;
const WEBHOOKS_PER_MINUTE: u32 = 120;
const CONCURRENT_PASSWORD_HASHES: usize = 4;
const RECONCILE_INTERVAL: Duration = Duration::from_secs(45);

/// Periodically compares unpaid invoices with PayPal, in case a webhook was missed.
fn spawn_reconciler(state: AppState) {
    tokio::spawn(async move {
        let mut ticker = tokio::time::interval(RECONCILE_INTERVAL);
        loop {
            ticker.tick().await;
            if let Err(err) = service::invoices::reconcile_all(&state).await {
                tracing::warn!(error = %err, "invoice reconciliation failed");
            }
        }
    });
}

fn build_router(state: AppState) -> Router {
    let static_dir = Path::new(&state.cfg.static_dir);
    let spa = ServeDir::new(static_dir).fallback(ServeFile::new(static_dir.join("index.html")));
    let api = api::router()
        .fallback(|| async { AppError::NotFound })
        .layer(middleware::from_fn(security::same_origin))
        .layer(RequestBodyLimitLayer::new(MAX_BODY_BYTES));
    Router::new()
        .nest("/api", api)
        .fallback_service(spa)
        .layer(middleware::from_fn(security::headers))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env from the working directory or its parent (the repo root during development).
    if dotenvy::dotenv().is_err() {
        let _ = dotenvy::from_filename("../.env");
    }
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tower_http=warn".into()),
        )
        .init();

    let cfg = Config::from_env()?;
    let db = PgPoolOptions::new()
        .max_connections(DB_MAX_CONNECTIONS)
        .acquire_timeout(Duration::from_secs(15))
        .connect(&cfg.database_url)
        .await
        .context("connecting to the database")?;
    repo::migrate(&db)
        .await
        .context("applying the database schema")?;

    let state = AppState {
        db,
        paypal: PayPal::new(&cfg)?,
        gemini: Gemini::new(&cfg)?,
        limiters: Arc::new(Limiters {
            signup: RateLimiter::new(SIGNUPS_PER_HOUR, HOUR),
            login: RateLimiter::new(LOGINS_PER_TEN_MINUTES, TEN_MINUTES),
            paypal: RateLimiter::new(PAYPAL_CALLS_PER_MINUTE, MINUTE),
            webhook: RateLimiter::new(WEBHOOKS_PER_MINUTE, MINUTE),
            password_hashing: Semaphore::new(CONCURRENT_PASSWORD_HASHES),
        }),
        cfg: Arc::new(cfg),
    };
    spawn_reconciler(state.clone());

    let addr = SocketAddr::from(([0, 0, 0, 0], state.cfg.port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .with_context(|| format!("binding {addr}"))?;
    tracing::info!(%addr, "Duely server listening");
    axum::serve(listener, build_router(state))
        .await
        .context("serving")?;
    Ok(())
}
