use axum::extract::{Query, State};
use axum::response::IntoResponse;
use axum::Json;
use chrono::{DateTime, Duration, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::agent::MAX_POLICY_LEN;
use crate::auth::AuthUser;
use crate::error::{ok, AppResult};
use crate::models::{
    ActionDto, InvoiceDto, InvoiceRow, ACTION_PENDING, STATUS_DRAFT, STATUS_PAID, STATUS_SENDING,
    STATUS_SENT,
};
use crate::money::format_cents;
use crate::repo::activity::ACTOR_USER;
use crate::repo::{actions, activity, invoices, policy, usage};
use crate::service::{self, detached, today};
use crate::state::AppState;
use crate::validation::optional_text;

const PAID_WINDOW_DAYS: i64 = 30;
const PENDING_LIMIT: i64 = 100;
const DEFAULT_ACTIVITY_LIMIT: i64 = 50;
const MAX_ACTIVITY_LIMIT: i64 = 200;

#[derive(Debug, Serialize, PartialEq)]
struct Counts {
    draft: usize,
    sent: usize,
    overdue: usize,
    paid: usize,
}

#[derive(Debug, Serialize, PartialEq)]
struct Summary {
    outstanding_total: String,
    overdue_total: String,
    paid_30d_total: String,
    counts: Counts,
}

fn summarize(rows: &[InvoiceRow], today: NaiveDate, now: DateTime<Utc>) -> Summary {
    let sum = |filter: &dyn Fn(&&InvoiceRow) -> bool| -> i64 {
        rows.iter().filter(filter).map(|r| r.total_cents).sum()
    };
    let count = |filter: &dyn Fn(&&InvoiceRow) -> bool| rows.iter().filter(filter).count();
    let is_sent = |r: &&InvoiceRow| r.status == STATUS_SENT;
    let is_overdue = |r: &&InvoiceRow| r.days_overdue(today) > 0;
    let is_draft = |r: &&InvoiceRow| r.status == STATUS_DRAFT || r.status == STATUS_SENDING;
    let is_paid = |r: &&InvoiceRow| r.status == STATUS_PAID;
    let window_start = now - Duration::days(PAID_WINDOW_DAYS);
    let paid_recently =
        |r: &&InvoiceRow| r.status == STATUS_PAID && r.paid_at.is_some_and(|at| at >= window_start);
    Summary {
        outstanding_total: format_cents(sum(&is_sent)),
        overdue_total: format_cents(sum(&is_overdue)),
        paid_30d_total: format_cents(sum(&paid_recently)),
        counts: Counts {
            draft: count(&is_draft),
            sent: count(&is_sent),
            overdue: count(&is_overdue),
            paid: count(&is_paid),
        },
    }
}

pub async fn dashboard(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> AppResult<impl IntoResponse> {
    let rows = invoices::list(&state.db, user.id).await?;
    let pending = actions::list(&state.db, user.id, Some(ACTION_PENDING), PENDING_LIMIT).await?;
    let calls_today = usage::agent_calls_today(&state.db, user.id).await?;
    let today = today();
    let summary = summarize(&rows, today, Utc::now());
    Ok(ok(json!({
        "summary": summary,
        "invoices": rows.into_iter().map(|row| InvoiceDto::from_row(row, today)).collect::<Vec<_>>(),
        "pending_actions": pending.into_iter().map(|row| ActionDto::from_row(row, today)).collect::<Vec<_>>(),
        "usage": { "agent_calls_today": calls_today, "agent_daily_limit": state.cfg.agent_daily_limit },
    })))
}

pub async fn get_policy(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> AppResult<impl IntoResponse> {
    Ok(ok(
        json!({ "policy": policy::get(&state.db, user.id).await? }),
    ))
}

#[derive(Deserialize)]
pub struct PolicyBody {
    text: String,
    auto_send: bool,
}

pub async fn put_policy(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(body): Json<PolicyBody>,
) -> AppResult<impl IntoResponse> {
    let text = optional_text(&body.text, "Policy", MAX_POLICY_LEN)?;
    let saved = policy::upsert(&state.db, user.id, &text, body.auto_send).await?;
    let mode = if saved.auto_send { "on" } else { "off" };
    let summary = format!("Updated the collection policy (auto-send {mode})");
    activity::log(
        &state.db,
        user.id,
        None,
        ACTOR_USER,
        "policy_updated",
        &summary,
    )
    .await?;
    Ok(ok(json!({ "policy": saved })))
}

#[derive(Deserialize)]
pub struct ActivityQuery {
    limit: Option<i64>,
}

pub async fn list_activity(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<ActivityQuery>,
) -> AppResult<impl IntoResponse> {
    let limit = query
        .limit
        .unwrap_or(DEFAULT_ACTIVITY_LIMIT)
        .clamp(1, MAX_ACTIVITY_LIMIT);
    Ok(ok(
        json!({ "activity": activity::list(&state.db, user.id, limit).await? }),
    ))
}

pub async fn seed(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> AppResult<impl IntoResponse> {
    let task_state = state.clone();
    let rows = detached(async move { service::seed::load(&task_state, &user).await }).await?;
    let today = today();
    let dtos: Vec<InvoiceDto> = rows
        .into_iter()
        .map(|row| InvoiceDto::from_row(row, today))
        .collect();
    Ok(ok(json!({ "invoices": dtos })))
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::types::Json as SqlJson;
    use uuid::Uuid;

    fn invoice(
        status: &str,
        total_cents: i64,
        due: NaiveDate,
        paid_at: Option<DateTime<Utc>>,
    ) -> InvoiceRow {
        InvoiceRow {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            status: status.into(),
            paypal_invoice_id: None,
            number: None,
            recipient_name: "Client".into(),
            recipient_email: "c@example.com".into(),
            items: SqlJson(vec![]),
            total_cents,
            due_date: due,
            note: String::new(),
            pay_url: None,
            reminder_count: 0,
            last_reminded_at: None,
            created_at: Utc::now(),
            sent_at: None,
            paid_at,
        }
    }

    #[test]
    fn totals_outstanding_overdue_and_recent_payments() {
        let today = NaiveDate::from_ymd_opt(2026, 11, 12).unwrap();
        let now = Utc::now();
        let rows = vec![
            invoice(STATUS_SENT, 10_000, today - Duration::days(5), None),
            invoice(STATUS_SENT, 20_000, today + Duration::days(5), None),
            invoice(
                STATUS_PAID,
                30_000,
                today - Duration::days(20),
                Some(now - Duration::days(2)),
            ),
            invoice(
                STATUS_PAID,
                40_000,
                today - Duration::days(90),
                Some(now - Duration::days(60)),
            ),
            invoice(STATUS_DRAFT, 50_000, today - Duration::days(1), None),
        ];
        let summary = summarize(&rows, today, now);
        assert_eq!(summary.outstanding_total, "300.00");
        assert_eq!(summary.overdue_total, "100.00");
        assert_eq!(summary.paid_30d_total, "300.00");
        assert_eq!(
            summary.counts,
            Counts {
                draft: 1,
                sent: 2,
                overdue: 1,
                paid: 2
            }
        );
    }

    #[test]
    fn invoice_due_today_is_not_overdue() {
        let today = NaiveDate::from_ymd_opt(2026, 11, 12).unwrap();
        let summary = summarize(
            &[invoice(STATUS_SENT, 10_000, today, None)],
            today,
            Utc::now(),
        );
        assert_eq!(summary.counts.overdue, 0);
    }
}
