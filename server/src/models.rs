use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::types::Json;
use uuid::Uuid;

use crate::money::format_cents;

pub const STATUS_DRAFT: &str = "draft";
/// Transient status while the PayPal create+send calls are in flight, so a draft is never sent twice.
pub const STATUS_SENDING: &str = "sending";
pub const STATUS_SENT: &str = "sent";
pub const STATUS_PAID: &str = "paid";
pub const STATUS_CANCELLED: &str = "cancelled";

pub const ACTION_REMIND: &str = "remind";
pub const ACTION_WAIT: &str = "wait";

pub const ACTION_PENDING: &str = "pending";
pub const ACTION_EXECUTED: &str = "executed";
pub const ACTION_REJECTED: &str = "rejected";
pub const ACTION_SUPERSEDED: &str = "superseded";

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InvoiceItem {
    pub name: String,
    pub quantity: f64,
    /// Decimal string, e.g. "500.00".
    pub unit_price: String,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct InvoiceRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub status: String,
    pub paypal_invoice_id: Option<String>,
    pub number: Option<String>,
    pub recipient_name: String,
    pub recipient_email: String,
    pub items: Json<Vec<InvoiceItem>>,
    pub total_cents: i64,
    pub due_date: NaiveDate,
    pub note: String,
    pub pay_url: Option<String>,
    pub reminder_count: i32,
    pub last_reminded_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub sent_at: Option<DateTime<Utc>>,
    pub paid_at: Option<DateTime<Utc>>,
}

impl InvoiceRow {
    pub fn days_overdue(&self, today: NaiveDate) -> i64 {
        if self.status != STATUS_SENT {
            return 0;
        }
        (today - self.due_date).num_days().max(0)
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct InvoiceDto {
    pub id: Uuid,
    pub number: Option<String>,
    pub status: String,
    pub recipient_name: String,
    pub recipient_email: String,
    pub currency: &'static str,
    pub items: Vec<InvoiceItem>,
    pub total: String,
    pub due_date: NaiveDate,
    pub note: String,
    pub pay_url: Option<String>,
    pub is_overdue: bool,
    pub days_overdue: i64,
    pub reminder_count: i32,
    pub last_reminded_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub sent_at: Option<DateTime<Utc>>,
    pub paid_at: Option<DateTime<Utc>>,
}

impl InvoiceDto {
    pub fn from_row(row: InvoiceRow, today: NaiveDate) -> Self {
        let days_overdue = row.days_overdue(today);
        // "sending" is an internal claim state; to the UI the invoice is still a draft.
        let status = if row.status == STATUS_SENDING {
            STATUS_DRAFT.to_string()
        } else {
            row.status
        };
        Self {
            id: row.id,
            number: row.number,
            status,
            recipient_name: row.recipient_name,
            recipient_email: row.recipient_email,
            currency: "USD",
            items: row.items.0,
            total: format_cents(row.total_cents),
            due_date: row.due_date,
            note: row.note,
            pay_url: row.pay_url,
            is_overdue: days_overdue > 0,
            days_overdue,
            reminder_count: row.reminder_count,
            last_reminded_at: row.last_reminded_at,
            created_at: row.created_at,
            sent_at: row.sent_at,
            paid_at: row.paid_at,
        }
    }
}

/// An action joined with the invoice fields the UI shows next to it.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ActionRow {
    pub id: Uuid,
    pub invoice_id: Uuid,
    pub kind: String,
    pub subject: String,
    pub message: String,
    pub reasoning: String,
    pub status: String,
    pub error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub executed_at: Option<DateTime<Utc>>,
    pub invoice_number: Option<String>,
    pub invoice_recipient_name: String,
    pub invoice_total_cents: i64,
    pub invoice_due_date: NaiveDate,
    pub invoice_status: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ActionInvoiceDto {
    pub number: Option<String>,
    pub recipient_name: String,
    pub total: String,
    pub days_overdue: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ActionDto {
    pub id: Uuid,
    pub invoice_id: Uuid,
    pub invoice: ActionInvoiceDto,
    pub kind: String,
    pub subject: String,
    pub message: String,
    pub reasoning: String,
    pub status: String,
    pub error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub executed_at: Option<DateTime<Utc>>,
}

impl ActionDto {
    pub fn from_row(row: ActionRow, today: NaiveDate) -> Self {
        let days_overdue = if row.invoice_status == STATUS_SENT {
            (today - row.invoice_due_date).num_days().max(0)
        } else {
            0
        };
        Self {
            id: row.id,
            invoice_id: row.invoice_id,
            invoice: ActionInvoiceDto {
                number: row.invoice_number,
                recipient_name: row.invoice_recipient_name,
                total: format_cents(row.invoice_total_cents),
                days_overdue,
            },
            kind: row.kind,
            subject: row.subject,
            message: row.message,
            reasoning: row.reasoning,
            status: row.status,
            error: row.error,
            created_at: row.created_at,
            executed_at: row.executed_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Activity {
    pub id: Uuid,
    pub invoice_id: Option<Uuid>,
    pub actor: String,
    pub kind: String,
    pub summary: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Policy {
    pub text: String,
    pub auto_send: bool,
    pub updated_at: Option<DateTime<Utc>>,
}

/// What an agent run changed, so the UI can show it inline.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Effect {
    InvoiceDrafted { invoice_id: Uuid },
    ActionProposed { action_id: Uuid },
    ActionExecuted { action_id: Uuid },
    PolicyUpdated,
}
