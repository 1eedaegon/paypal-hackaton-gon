//! Sample data: real PayPal sandbox invoices with backdated due dates, so a new workspace
//! has something overdue for the agent to work on.

use chrono::{Duration, Utc};
use uuid::Uuid;

use super::{describe, today};
use crate::error::{AppError, AppResult};
use crate::models::{InvoiceItem, InvoiceRow, User};
use crate::repo::activity::ACTOR_SYSTEM;
use crate::repo::{activity, invoices, usage};
use crate::service::invoices::deliver;
use crate::state::AppState;
use crate::validation::ValidInvoice;

const INVOICE_LEAD_DAYS: i64 = 14;

struct Sample {
    client: &'static str,
    email: &'static str,
    item: &'static str,
    amount_cents: i64,
    /// Due date relative to today; negative means overdue.
    due_in_days: i64,
    paid: bool,
}

const SAMPLES: [Sample; 5] = [
    Sample {
        client: "Lumen Coffee Co.",
        email: "accounts@lumencoffee.example",
        item: "Menu redesign",
        amount_cents: 65_000,
        due_in_days: -40,
        paid: true,
    },
    Sample {
        client: "Northwind Studio",
        email: "billing@northwind-studio.example",
        item: "Brand identity package",
        amount_cents: 180_000,
        due_in_days: -12,
        paid: false,
    },
    Sample {
        client: "Lumen Coffee Co.",
        email: "accounts@lumencoffee.example",
        item: "Seasonal campaign illustrations",
        amount_cents: 42_000,
        due_in_days: -4,
        paid: false,
    },
    Sample {
        client: "Harbor & Pine",
        email: "hello@harborandpine.example",
        item: "Website copy translation",
        amount_cents: 96_000,
        due_in_days: -5,
        paid: false,
    },
    Sample {
        client: "Kestrel Labs",
        email: "ap@kestrellabs.example",
        item: "Landing page development",
        amount_cents: 240_000,
        due_in_days: 9,
        paid: false,
    },
];

fn to_valid(sample: &Sample) -> ValidInvoice {
    ValidInvoice {
        recipient_name: sample.client.to_string(),
        recipient_email: sample.email.to_string(),
        items: vec![InvoiceItem {
            name: sample.item.to_string(),
            quantity: 1.0,
            unit_price: crate::money::format_cents(sample.amount_cents),
        }],
        total_cents: sample.amount_cents,
        due_date: today() + Duration::days(sample.due_in_days),
        note: "Thank you for your business.".to_string(),
    }
}

async fn create_sample(state: &AppState, user: &User, sample: &Sample) -> AppResult<InvoiceRow> {
    let draft = invoices::insert_draft(&state.db, user.id, &to_valid(sample)).await?;
    let lead = Duration::days(INVOICE_LEAD_DAYS);
    let remote = match deliver(state, &user.name, &draft, draft.due_date - lead).await {
        Ok(remote) => remote,
        Err(err) => {
            invoices::delete_draft(&state.db, user.id, draft.id).await?;
            return Err(err);
        }
    };
    let sent_at = Utc::now() + Duration::days(sample.due_in_days) - lead;
    let sent = invoices::mark_sent(&state.db, draft.id, &remote, sent_at).await?;
    let summary = format!("Loaded sample invoice {}", describe(&sent));
    activity::log(
        &state.db,
        user.id,
        Some(sent.id),
        ACTOR_SYSTEM,
        "sample_loaded",
        &summary,
    )
    .await?;
    if !sample.paid {
        return Ok(sent);
    }
    state
        .paypal
        .record_payment(&remote.id, sent.total_cents, today())
        .await?;
    let paid = invoices::mark_paid(&state.db, sent.id).await?;
    Ok(paid.unwrap_or(sent))
}

async fn claim_seed(state: &AppState, user_id: Uuid) -> AppResult<bool> {
    let result = sqlx::query("UPDATE users SET seeded = TRUE WHERE id = $1 AND seeded = FALSE")
        .bind(user_id)
        .execute(&state.db)
        .await?;
    Ok(result.rows_affected() == 1)
}

async fn release_seed(state: &AppState, user_id: Uuid) -> AppResult<()> {
    sqlx::query("UPDATE users SET seeded = FALSE WHERE id = $1")
        .bind(user_id)
        .execute(&state.db)
        .await?;
    Ok(())
}

/// Loads the sample invoices once per user.
pub async fn load(state: &AppState, user: &User) -> AppResult<Vec<InvoiceRow>> {
    if !claim_seed(state, user.id).await? {
        return Err(AppError::Conflict(
            "Sample data has already been loaded for this account.".into(),
        ));
    }
    let result = load_samples(state, user).await;
    if result.is_err() {
        release_seed(state, user.id).await?;
    }
    result
}

async fn load_samples(state: &AppState, user: &User) -> AppResult<Vec<InvoiceRow>> {
    usage::consume_invoice_sends(&state.db, &state.cfg, user.id, SAMPLES.len() as i32).await?;
    let mut created = Vec::with_capacity(SAMPLES.len());
    for sample in &SAMPLES {
        created.push(create_sample(state, user, sample).await?);
    }
    Ok(created)
}
