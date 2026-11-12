//! JSON API routes for the workspace.

mod actions;
mod invoices;
mod webhook;
mod workspace;

use axum::routing::{get, post};
use axum::Router;

use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .nest("/auth", crate::auth::router())
        .nest("/agent", crate::agent::router())
        .nest("/invoices", invoices::router())
        .nest("/actions", actions::router())
        .route("/dashboard", get(workspace::dashboard))
        .route(
            "/policy",
            get(workspace::get_policy).put(workspace::put_policy),
        )
        .route("/activity", get(workspace::list_activity))
        .route("/demo/seed", post(workspace::seed))
        .route("/webhooks/paypal", post(webhook::receive))
}
