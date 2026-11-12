//! Input validation shared by the HTTP handlers and the agent tools.

use chrono::{Duration, NaiveDate};
use serde::Deserialize;

use crate::error::{AppError, AppResult};
use crate::models::InvoiceItem;
use crate::money::{format_cents, line_total_cents, parse_cents};

const MAX_EMAIL_LEN: usize = 254;
const MAX_NAME_LEN: usize = 120;
const MAX_NOTE_LEN: usize = 1000;
const MAX_ITEMS: usize = 20;
const MAX_QUANTITY: f64 = 10_000.0;
const MAX_UNIT_CENTS: i64 = 100_000_000;
const MAX_TOTAL_CENTS: i64 = 100_000_000;
const MAX_DUE_DATE_DISTANCE_DAYS: i64 = 730;

pub fn normalize_email(input: &str) -> AppResult<String> {
    let email = input.trim().to_lowercase();
    let valid = email.len() <= MAX_EMAIL_LEN
        && !email.contains(char::is_whitespace)
        && email.split_once('@').is_some_and(|(local, domain)| {
            !local.is_empty()
                && domain.contains('.')
                && !domain.starts_with('.')
                && !domain.ends_with('.')
        });
    if !valid {
        return Err(AppError::invalid("Enter a valid email address."));
    }
    Ok(email)
}

pub fn required_text(input: &str, field: &str, max_len: usize) -> AppResult<String> {
    let text = input.trim();
    if text.is_empty() {
        return Err(AppError::invalid(format!("{field} is required.")));
    }
    if text.chars().count() > max_len {
        return Err(AppError::invalid(format!(
            "{field} must be at most {max_len} characters."
        )));
    }
    Ok(text.to_string())
}

pub fn optional_text(input: &str, field: &str, max_len: usize) -> AppResult<String> {
    let text = input.trim();
    if text.chars().count() > max_len {
        return Err(AppError::invalid(format!(
            "{field} must be at most {max_len} characters."
        )));
    }
    Ok(text.to_string())
}

#[derive(Debug, Clone, Deserialize)]
pub struct InvoiceInput {
    pub recipient_name: String,
    pub recipient_email: String,
    pub items: Vec<InvoiceItem>,
    pub due_date: NaiveDate,
    #[serde(default)]
    pub note: String,
}

/// An invoice that passed validation, with normalized fields and a computed total.
#[derive(Debug, Clone, PartialEq)]
pub struct ValidInvoice {
    pub recipient_name: String,
    pub recipient_email: String,
    pub items: Vec<InvoiceItem>,
    pub total_cents: i64,
    pub due_date: NaiveDate,
    pub note: String,
}

fn validate_item(item: &InvoiceItem) -> AppResult<(InvoiceItem, i64)> {
    let name = required_text(&item.name, "Item name", MAX_NAME_LEN)?;
    if !(item.quantity.is_finite() && item.quantity > 0.0 && item.quantity <= MAX_QUANTITY) {
        return Err(AppError::invalid(format!(
            "Quantity for \"{name}\" must be greater than 0."
        )));
    }
    let unit_cents = parse_cents(&item.unit_price)
        .filter(|cents| *cents <= MAX_UNIT_CENTS)
        .ok_or_else(|| AppError::invalid(format!("Price for \"{name}\" is not a valid amount.")))?;
    let normalized = InvoiceItem {
        name,
        quantity: item.quantity,
        unit_price: format_cents(unit_cents),
    };
    Ok((normalized, line_total_cents(item.quantity, unit_cents)))
}

pub fn validate_invoice(input: &InvoiceInput, today: NaiveDate) -> AppResult<ValidInvoice> {
    if input.items.is_empty() || input.items.len() > MAX_ITEMS {
        return Err(AppError::invalid(format!(
            "An invoice needs between 1 and {MAX_ITEMS} line items."
        )));
    }
    let validated = input
        .items
        .iter()
        .map(validate_item)
        .collect::<AppResult<Vec<_>>>()?;
    let total_cents: i64 = validated.iter().map(|(_, cents)| cents).sum();
    if total_cents <= 0 || total_cents > MAX_TOTAL_CENTS {
        return Err(AppError::invalid(
            "The invoice total must be between $0.01 and $1,000,000.",
        ));
    }
    let distance = Duration::days(MAX_DUE_DATE_DISTANCE_DAYS);
    if input.due_date < today - distance || input.due_date > today + distance {
        return Err(AppError::invalid(
            "The due date must be within two years of today.",
        ));
    }
    Ok(ValidInvoice {
        recipient_name: required_text(&input.recipient_name, "Client name", MAX_NAME_LEN)?,
        recipient_email: normalize_email(&input.recipient_email)?,
        items: validated.into_iter().map(|(item, _)| item).collect(),
        total_cents,
        due_date: input.due_date,
        note: optional_text(&input.note, "Note", MAX_NOTE_LEN)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn today() -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 11, 12).unwrap()
    }

    fn input() -> InvoiceInput {
        InvoiceInput {
            recipient_name: " Acme Studio ".into(),
            recipient_email: "Billing@Acme.example ".into(),
            items: vec![
                InvoiceItem {
                    name: "Logo design".into(),
                    quantity: 1.0,
                    unit_price: "500".into(),
                },
                InvoiceItem {
                    name: "Revisions".into(),
                    quantity: 2.5,
                    unit_price: "40.00".into(),
                },
            ],
            due_date: NaiveDate::from_ymd_opt(2026, 11, 19).unwrap(),
            note: String::new(),
        }
    }

    #[test]
    fn normalizes_fields_and_computes_total() {
        let valid = validate_invoice(&input(), today()).unwrap();
        assert_eq!(valid.recipient_name, "Acme Studio");
        assert_eq!(valid.recipient_email, "billing@acme.example");
        assert_eq!(valid.items[0].unit_price, "500.00");
        assert_eq!(valid.total_cents, 60000);
    }

    #[test]
    fn rejects_invoice_without_items() {
        let bad = InvoiceInput {
            items: vec![],
            ..input()
        };
        assert!(validate_invoice(&bad, today()).is_err());
    }

    #[test]
    fn rejects_non_positive_quantity_and_bad_price() {
        let zero_quantity = InvoiceInput {
            items: vec![InvoiceItem {
                name: "x".into(),
                quantity: 0.0,
                unit_price: "5".into(),
            }],
            ..input()
        };
        let bad_price = InvoiceInput {
            items: vec![InvoiceItem {
                name: "x".into(),
                quantity: 1.0,
                unit_price: "five".into(),
            }],
            ..input()
        };
        assert!(validate_invoice(&zero_quantity, today()).is_err());
        assert!(validate_invoice(&bad_price, today()).is_err());
    }

    #[test]
    fn rejects_invalid_email_addresses() {
        for email in ["", "no-at-sign", "a@b", "a b@c.com", "@c.com", "a@.com"] {
            assert!(
                normalize_email(email).is_err(),
                "{email} should be rejected"
            );
        }
    }

    #[test]
    fn rejects_due_date_far_from_today() {
        let bad = InvoiceInput {
            due_date: NaiveDate::from_ymd_opt(2030, 1, 1).unwrap(),
            ..input()
        };
        assert!(validate_invoice(&bad, today()).is_err());
    }
}
