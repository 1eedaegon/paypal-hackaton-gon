//! Business operations shared by the HTTP handlers, the agent tools and the PayPal callbacks.

pub mod actions;
pub mod invoices;
pub mod seed;

use std::future::Future;

use chrono::{NaiveDate, Utc};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::InvoiceRow;
use crate::money::format_cents;
use crate::state::AppState;

pub fn today() -> NaiveDate {
    Utc::now().date_naive()
}

/// "#0007 to Acme Studio ($500.00)" — how an invoice is named in the activity log.
pub fn describe(invoice: &InvoiceRow) -> String {
    let number = invoice
        .number
        .as_deref()
        .map(|n| format!("#{n} "))
        .unwrap_or_default();
    format!(
        "{number}to {} (${})",
        invoice.recipient_name,
        format_cents(invoice.total_cents)
    )
}

/// Runs work that talks to PayPal on its own task, so it finishes even if the HTTP connection
/// that started it goes away.
pub async fn detached<T, F>(work: F) -> AppResult<T>
where
    T: Send + 'static,
    F: Future<Output = AppResult<T>> + Send + 'static,
{
    tokio::spawn(work)
        .await
        .map_err(|err| AppError::Internal(err.into()))?
}

/// Per-user throttle for endpoints that call PayPal but have no daily quota of their own.
pub fn throttle_paypal(state: &AppState, user_id: Uuid) -> AppResult<()> {
    if state.limiters.paypal.allow(&user_id.to_string()) {
        Ok(())
    } else {
        Err(AppError::RateLimited)
    }
}
