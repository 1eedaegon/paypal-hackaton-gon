use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::json;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::error::{ok, AppResult};
use crate::models::{ActionDto, InvoiceDto};
use crate::repo::activity::ACTOR_USER;
use crate::repo::{actions, activity, invoices};
use crate::service::{self, detached, throttle_paypal, today};
use crate::state::AppState;
use crate::validation::{validate_invoice, InvoiceInput};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/{id}", get(detail).patch(update).delete(discard))
        .route("/{id}/send", post(send))
        .route("/{id}/record-payment", post(record_payment))
        .route("/{id}/sync", post(sync))
}

async fn detail(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let invoice = invoices::find(&state.db, user.id, id).await?;
    let invoice_actions = actions::list_for_invoice(&state.db, user.id, id).await?;
    let invoice_activity = activity::list_for_invoice(&state.db, user.id, id).await?;
    let today = today();
    Ok(ok(json!({
        "invoice": InvoiceDto::from_row(invoice, today),
        "actions": invoice_actions.into_iter().map(|row| ActionDto::from_row(row, today)).collect::<Vec<_>>(),
        "activity": invoice_activity,
    })))
}

async fn update(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<InvoiceInput>,
) -> AppResult<impl IntoResponse> {
    let valid = validate_invoice(&body, today())?;
    let invoice = invoices::update_draft(&state.db, user.id, id, &valid).await?;
    Ok(ok(
        json!({ "invoice": InvoiceDto::from_row(invoice, today()) }),
    ))
}

async fn discard(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let invoice = invoices::find(&state.db, user.id, id).await?;
    invoices::delete_draft(&state.db, user.id, id).await?;
    let summary = format!(
        "Discarded the draft invoice {}",
        service::describe(&invoice)
    );
    activity::log(
        &state.db,
        user.id,
        None,
        ACTOR_USER,
        "draft_discarded",
        &summary,
    )
    .await?;
    Ok(ok(json!({})))
}

async fn send(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    // Runs to completion even if the browser disconnects, so a claimed draft is never left half sent.
    let task_state = state.clone();
    let invoice = detached(async move { service::invoices::send(&task_state, &user, id).await }).await?;
    Ok(ok(
        json!({ "invoice": InvoiceDto::from_row(invoice, today()) }),
    ))
}

async fn record_payment(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    throttle_paypal(&state, user.id)?;
    let invoice = service::invoices::record_payment(&state, &user, id).await?;
    Ok(ok(
        json!({ "invoice": InvoiceDto::from_row(invoice, today()) }),
    ))
}

async fn sync(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    throttle_paypal(&state, user.id)?;
    let invoice = service::invoices::sync(&state, &user, id).await?;
    Ok(ok(
        json!({ "invoice": InvoiceDto::from_row(invoice, today()) }),
    ))
}
