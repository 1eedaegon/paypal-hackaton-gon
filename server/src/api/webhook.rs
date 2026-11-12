use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use serde_json::Value;

use crate::paypal::webhook::invoice_id_of;
use crate::security::client_key;
use crate::service;
use crate::state::AppState;

const MAX_EVENT_ID_LEN: usize = 128;

/// Returns false when this event id was already processed (PayPal retries deliveries).
async fn first_delivery(state: &AppState, event_id: &str) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("INSERT INTO webhook_events (id) VALUES ($1) ON CONFLICT DO NOTHING")
        .bind(event_id)
        .execute(&state.db)
        .await?;
    Ok(result.rows_affected() == 1)
}

async fn is_authentic(state: &AppState, headers: &HeaderMap, body: &str) -> bool {
    let Some(webhook_id) = state.cfg.paypal_webhook_id.as_deref() else {
        // Without a webhook id nothing can be verified, so nothing is accepted. Payments are
        // still picked up by the background reconciler.
        return false;
    };
    match state.paypal.verify_webhook(headers, webhook_id, body).await {
        Ok(valid) => valid,
        Err(err) => {
            tracing::warn!(error = %err, "webhook signature check failed");
            false
        }
    }
}

/// PayPal webhook receiver. The payload is never trusted for state: it only tells us which
/// invoice to re-read from the PayPal API.
pub async fn receive(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: String,
) -> StatusCode {
    if !state.limiters.webhook.allow(&client_key(&headers)) {
        return StatusCode::TOO_MANY_REQUESTS;
    }
    let Ok(event) = serde_json::from_str::<Value>(&body) else {
        return StatusCode::BAD_REQUEST;
    };
    if !is_authentic(&state, &headers, &body).await {
        return StatusCode::UNAUTHORIZED;
    }
    let (Some(event_id), Some(invoice_id)) = (event["id"].as_str(), invoice_id_of(&event)) else {
        return StatusCode::OK;
    };
    if event_id.len() > MAX_EVENT_ID_LEN {
        return StatusCode::BAD_REQUEST;
    }
    match first_delivery(&state, event_id).await {
        Ok(true) => {}
        Ok(false) => return StatusCode::OK,
        Err(err) => {
            tracing::error!(error = %err, "could not record webhook event");
            return StatusCode::INTERNAL_SERVER_ERROR;
        }
    }
    if let Err(err) = service::invoices::sync_by_paypal_id(&state, invoice_id).await {
        tracing::error!(error = %err, %invoice_id, "webhook sync failed");
        // Forget the event so PayPal's retry is processed.
        let _ = sqlx::query("DELETE FROM webhook_events WHERE id = $1")
            .bind(event_id)
            .execute(&state.db)
            .await;
        return StatusCode::INTERNAL_SERVER_ERROR;
    }
    StatusCode::OK
}
