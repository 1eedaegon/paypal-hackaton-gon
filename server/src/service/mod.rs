//! Business operations shared by the HTTP handlers, the agent tools and the PayPal callbacks.

pub mod actions;
pub mod invoices;
pub mod seed;

use chrono::{NaiveDate, Utc};

use crate::models::InvoiceRow;
use crate::money::format_cents;

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
