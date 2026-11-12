use chrono::NaiveDate;
use reqwest::Method;
use serde_json::{json, Value};

use super::PayPal;
use crate::error::{AppError, AppResult};
use crate::models::{InvoiceItem, STATUS_CANCELLED, STATUS_PAID, STATUS_SENT};
use crate::money::format_cents;

const CURRENCY: &str = "USD";
const LIST_PAGE_SIZE: u32 = 100;

pub struct NewInvoice<'a> {
    pub invoicer_name: &'a str,
    pub recipient_name: &'a str,
    pub recipient_email: &'a str,
    pub items: &'a [InvoiceItem],
    pub invoice_date: NaiveDate,
    pub due_date: NaiveDate,
    pub note: &'a str,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RemoteInvoice {
    pub id: String,
    pub number: Option<String>,
    pub pay_url: Option<String>,
    /// PayPal's own status string, e.g. "SENT" or "MARKED_AS_PAID".
    pub status: String,
}

/// Maps a PayPal invoice status onto Duely's. `None` means "not sent yet" (draft or scheduled).
pub fn local_status(paypal_status: &str) -> Option<&'static str> {
    match paypal_status {
        "PAID" | "MARKED_AS_PAID" => Some(STATUS_PAID),
        "CANCELLED" | "REFUNDED" | "PARTIALLY_REFUNDED" | "MARKED_AS_REFUNDED" => {
            Some(STATUS_CANCELLED)
        }
        "SENT" | "UNPAID" | "PARTIALLY_PAID" | "PAYMENT_PENDING" => Some(STATUS_SENT),
        _ => None,
    }
}

fn create_body(invoice: &NewInvoice<'_>) -> Value {
    let items: Vec<Value> = invoice
        .items
        .iter()
        .map(|item| {
            json!({
                "name": item.name,
                "quantity": item.quantity.to_string(),
                "unit_amount": { "currency_code": CURRENCY, "value": item.unit_price },
            })
        })
        .collect();
    json!({
        "detail": {
            "currency_code": CURRENCY,
            "invoice_date": invoice.invoice_date.to_string(),
            "payment_term": { "due_date": invoice.due_date.to_string() },
            "note": invoice.note,
        },
        "invoicer": { "business_name": invoice.invoicer_name },
        "primary_recipients": [{
            "billing_info": {
                "business_name": invoice.recipient_name,
                "email_address": invoice.recipient_email,
            }
        }],
        "items": items,
    })
}

fn parse_invoice(value: &Value) -> AppResult<RemoteInvoice> {
    let id = value["id"]
        .as_str()
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("PayPal invoice without id")))?;
    Ok(RemoteInvoice {
        id: id.to_string(),
        number: value["detail"]["invoice_number"]
            .as_str()
            .map(str::to_string),
        pay_url: value["detail"]["metadata"]["recipient_view_url"]
            .as_str()
            .map(str::to_string),
        status: value["status"].as_str().unwrap_or("DRAFT").to_string(),
    })
}

impl PayPal {
    pub async fn create_invoice(&self, invoice: &NewInvoice<'_>) -> AppResult<RemoteInvoice> {
        let created = self
            .call(
                Method::POST,
                "/v2/invoicing/invoices",
                Some(&create_body(invoice)),
            )
            .await?;
        parse_invoice(&created)
    }

    pub async fn send_invoice(&self, id: &str) -> AppResult<()> {
        let body = json!({ "send_to_invoicer": false, "send_to_recipient": true });
        self.call(
            Method::POST,
            &format!("/v2/invoicing/invoices/{id}/send"),
            Some(&body),
        )
        .await?;
        Ok(())
    }

    pub async fn delete_invoice(&self, id: &str) -> AppResult<()> {
        self.call(
            Method::DELETE,
            &format!("/v2/invoicing/invoices/{id}"),
            None,
        )
        .await?;
        Ok(())
    }

    pub async fn get_invoice(&self, id: &str) -> AppResult<RemoteInvoice> {
        let value = self
            .call(Method::GET, &format!("/v2/invoicing/invoices/{id}"), None)
            .await?;
        parse_invoice(&value)
    }

    pub async fn remind_invoice(&self, id: &str, subject: &str, note: &str) -> AppResult<()> {
        let body = json!({ "subject": subject, "note": note, "send_to_invoicer": false, "send_to_recipient": true });
        self.call(
            Method::POST,
            &format!("/v2/invoicing/invoices/{id}/remind"),
            Some(&body),
        )
        .await?;
        Ok(())
    }

    /// Records a full payment that was received outside PayPal (e.g. a bank transfer).
    pub async fn record_payment(
        &self,
        id: &str,
        amount_cents: i64,
        date: NaiveDate,
    ) -> AppResult<()> {
        let body = json!({
            "method": "BANK_TRANSFER",
            "payment_date": date.to_string(),
            "amount": { "currency_code": CURRENCY, "value": format_cents(amount_cents) },
        });
        self.call(
            Method::POST,
            &format!("/v2/invoicing/invoices/{id}/payments"),
            Some(&body),
        )
        .await?;
        Ok(())
    }

    /// Most recent invoices of the merchant as `(paypal_invoice_id, paypal_status)`.
    pub async fn list_recent_statuses(&self) -> AppResult<Vec<(String, String)>> {
        let path = format!(
            "/v2/invoicing/invoices?page=1&page_size={LIST_PAGE_SIZE}&total_required=false"
        );
        let value = self.call(Method::GET, &path, None).await?;
        let statuses = value["items"]
            .as_array()
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| {
                        Some((
                            item["id"].as_str()?.to_string(),
                            item["status"].as_str()?.to_string(),
                        ))
                    })
                    .collect()
            })
            .unwrap_or_default();
        Ok(statuses)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_paypal_statuses_to_local_ones() {
        assert_eq!(local_status("PAID"), Some(STATUS_PAID));
        assert_eq!(local_status("MARKED_AS_PAID"), Some(STATUS_PAID));
        assert_eq!(local_status("SENT"), Some(STATUS_SENT));
        assert_eq!(local_status("PARTIALLY_PAID"), Some(STATUS_SENT));
        assert_eq!(local_status("CANCELLED"), Some(STATUS_CANCELLED));
        assert_eq!(local_status("DRAFT"), None);
    }

    #[test]
    fn builds_create_body_with_recipient_items_and_dates() {
        let items = vec![InvoiceItem {
            name: "Logo".into(),
            quantity: 2.0,
            unit_price: "250.00".into(),
        }];
        let body = create_body(&NewInvoice {
            invoicer_name: "Mina Park",
            recipient_name: "Acme",
            recipient_email: "billing@acme.example",
            items: &items,
            invoice_date: NaiveDate::from_ymd_opt(2026, 11, 12).unwrap(),
            due_date: NaiveDate::from_ymd_opt(2026, 11, 19).unwrap(),
            note: "Thanks",
        });
        assert_eq!(body["detail"]["payment_term"]["due_date"], "2026-11-19");
        assert_eq!(
            body["primary_recipients"][0]["billing_info"]["email_address"],
            "billing@acme.example"
        );
        assert_eq!(body["items"][0]["quantity"], "2");
        assert_eq!(body["items"][0]["unit_amount"]["value"], "250.00");
    }

    #[test]
    fn parses_invoice_representation() {
        let value = json!({
            "id": "INV2-AAAA",
            "status": "SENT",
            "detail": { "invoice_number": "0007", "metadata": { "recipient_view_url": "https://pay.example/x" } }
        });
        let parsed = parse_invoice(&value).unwrap();
        assert_eq!(parsed.number.as_deref(), Some("0007"));
        assert_eq!(parsed.pay_url.as_deref(), Some("https://pay.example/x"));
        assert_eq!(parsed.status, "SENT");
    }
}
