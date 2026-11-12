use axum::extract::{Path, Query, State};
use axum::response::IntoResponse;
use axum::routing::{get, patch, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::error::{ok, AppResult};
use crate::models::ActionDto;
use crate::repo::actions;
use crate::repo::activity::ACTOR_USER;
use crate::service::{self, today};
use crate::state::AppState;

const LIST_LIMIT: i64 = 100;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list))
        .route("/{id}", patch(edit))
        .route("/{id}/approve", post(approve))
        .route("/{id}/reject", post(reject))
}

#[derive(Deserialize)]
struct ListQuery {
    status: Option<String>,
}

async fn list(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<ListQuery>,
) -> AppResult<impl IntoResponse> {
    let rows = actions::list(&state.db, user.id, query.status.as_deref(), LIST_LIMIT).await?;
    let today = today();
    let dtos: Vec<ActionDto> = rows
        .into_iter()
        .map(|row| ActionDto::from_row(row, today))
        .collect();
    Ok(ok(json!({ "actions": dtos })))
}

async fn action_response(
    state: &AppState,
    user_id: Uuid,
    id: Uuid,
) -> AppResult<impl IntoResponse> {
    let row = actions::find(&state.db, user_id, id).await?;
    Ok(ok(json!({ "action": ActionDto::from_row(row, today()) })))
}

#[derive(Deserialize)]
struct EditBody {
    subject: String,
    message: String,
}

async fn edit(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<EditBody>,
) -> AppResult<impl IntoResponse> {
    service::actions::edit(&state, user.id, id, &body.subject, &body.message).await?;
    action_response(&state, user.id, id).await
}

async fn approve(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    service::actions::execute(&state, user.id, id, ACTOR_USER).await?;
    action_response(&state, user.id, id).await
}

async fn reject(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    service::actions::reject(&state, user.id, id).await?;
    action_response(&state, user.id, id).await
}
