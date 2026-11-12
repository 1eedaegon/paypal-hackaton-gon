use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    Invalid(String),
    #[error("Please log in to continue.")]
    Unauthorized,
    #[error("Not found.")]
    NotFound,
    #[error("{0}")]
    Conflict(String),
    #[error("{0}")]
    Quota(String),
    #[error("Too many attempts. Please wait a few minutes and try again.")]
    RateLimited,
    /// A PayPal or Gemini call failed. The message is safe to show to the user.
    #[error("{0}")]
    Upstream(String),
    #[error("Something went wrong on our side.")]
    Internal(#[from] anyhow::Error),
}

impl AppError {
    pub fn invalid(message: impl Into<String>) -> Self {
        Self::Invalid(message.into())
    }

    fn parts(&self) -> (StatusCode, &'static str) {
        match self {
            Self::Invalid(_) => (StatusCode::BAD_REQUEST, "invalid_input"),
            Self::Unauthorized => (StatusCode::UNAUTHORIZED, "unauthorized"),
            Self::NotFound => (StatusCode::NOT_FOUND, "not_found"),
            Self::Conflict(_) => (StatusCode::CONFLICT, "conflict"),
            Self::Quota(_) => (StatusCode::TOO_MANY_REQUESTS, "quota_exceeded"),
            Self::RateLimited => (StatusCode::TOO_MANY_REQUESTS, "rate_limited"),
            Self::Upstream(_) => (StatusCode::BAD_GATEWAY, "upstream_error"),
            Self::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal"),
        }
    }
}

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        Self::Internal(err.into())
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code) = self.parts();
        if let Self::Internal(err) = &self {
            tracing::error!(error = ?err, "internal error");
        }
        let body = json!({ "ok": false, "error": { "code": code, "message": self.to_string() } });
        (status, Json(body)).into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;

/// Success envelope: `{ "ok": true, "data": ... }`.
pub fn ok<T: Serialize>(data: T) -> Json<serde_json::Value> {
    Json(json!({ "ok": true, "data": data }))
}
