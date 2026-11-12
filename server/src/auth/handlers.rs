use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use axum_extra::extract::CookieJar;
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use super::password;
use super::session::{self, AuthUser, SESSION_COOKIE};
use crate::error::{ok, AppError, AppResult};
use crate::models::User;
use crate::security::client_key;
use crate::state::AppState;
use crate::validation::{normalize_email, required_text};

const MIN_PASSWORD_LEN: usize = 8;
const MAX_PASSWORD_LEN: usize = 200;
const MAX_NAME_LEN: usize = 80;
const MAX_SIGNUPS_PER_DAY: i64 = 400;
const DEFAULT_POLICY: &str = "Send a polite reminder once an invoice is 3 days overdue. Once it is 10 days \
overdue, send a firmer reminder. Clients who have paid me before get 3 extra days before the first reminder. \
Never send a second reminder within 4 days of the previous one.";

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/signup", post(signup))
        .route("/login", post(login))
        .route("/logout", post(logout))
        .route("/me", get(me))
}

fn limited(allowed: bool) -> AppResult<()> {
    if allowed {
        Ok(())
    } else {
        Err(AppError::RateLimited)
    }
}

/// A ceiling on new accounts per day across the whole demo, as a backstop behind per-address limits.
async fn check_signup_capacity(state: &AppState) -> AppResult<()> {
    let (today,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE")
            .fetch_one(&state.db)
            .await?;
    if today >= MAX_SIGNUPS_PER_DAY {
        return Err(AppError::Quota(
            "The demo has reached today's limit for new accounts. Please use the shared test account from the README.".into(),
        ));
    }
    Ok(())
}

fn validate_password(password: &str) -> AppResult<()> {
    let len = password.chars().count();
    if !(MIN_PASSWORD_LEN..=MAX_PASSWORD_LEN).contains(&len) {
        return Err(AppError::invalid(format!(
            "Password must be at least {MIN_PASSWORD_LEN} characters."
        )));
    }
    Ok(())
}

#[derive(Deserialize)]
struct SignupBody {
    email: String,
    password: String,
    name: String,
}

async fn signup(
    State(state): State<AppState>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(body): Json<SignupBody>,
) -> AppResult<impl IntoResponse> {
    limited(state.limiters.signup.allow(&client_key(&headers)))?;
    let email = normalize_email(&body.email)?;
    let name = required_text(&body.name, "Name", MAX_NAME_LEN)?;
    validate_password(&body.password)?;
    check_signup_capacity(&state).await?;
    let password_hash = password::hash(&state.limiters.password_hashing, body.password).await?;

    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4) \
         ON CONFLICT (email) DO NOTHING RETURNING id, email, name",
    )
    .bind(Uuid::new_v4())
    .bind(&email)
    .bind(&name)
    .bind(&password_hash)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| {
        AppError::Conflict("An account with this email already exists. Try logging in.".into())
    })?;

    sqlx::query("INSERT INTO policies (user_id, text) VALUES ($1, $2) ON CONFLICT DO NOTHING")
        .bind(user.id)
        .bind(DEFAULT_POLICY)
        .execute(&state.db)
        .await?;

    let token = session::create(&state.db, user.id).await?;
    Ok((
        jar.add(session::cookie(token, state.cfg.cookie_secure)),
        ok(json!({ "user": user })),
    ))
}

#[derive(Deserialize)]
struct LoginBody {
    email: String,
    password: String,
}

async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(body): Json<LoginBody>,
) -> AppResult<impl IntoResponse> {
    limited(state.limiters.login.allow(&client_key(&headers)))?;
    let wrong = || AppError::invalid("Email or password is incorrect.");
    let email = normalize_email(&body.email).map_err(|_| wrong())?;

    let row: Option<(Uuid, String, String, String)> =
        sqlx::query_as("SELECT id, email, name, password_hash FROM users WHERE email = $1")
            .bind(&email)
            .fetch_optional(&state.db)
            .await?;
    let (id, email, name, password_hash) = row.ok_or_else(wrong)?;
    if !password::verify(&state.limiters.password_hashing, body.password, password_hash).await? {
        return Err(wrong());
    }

    let token = session::create(&state.db, id).await?;
    let user = User { id, email, name };
    Ok((
        jar.add(session::cookie(token, state.cfg.cookie_secure)),
        ok(json!({ "user": user })),
    ))
}

async fn logout(State(state): State<AppState>, jar: CookieJar) -> AppResult<impl IntoResponse> {
    if let Some(cookie) = jar.get(SESSION_COOKIE) {
        session::destroy(&state.db, cookie.value()).await?;
    }
    Ok((jar.remove(session::removal_cookie()), ok(json!({}))))
}

async fn me(AuthUser(user): AuthUser) -> AppResult<impl IntoResponse> {
    Ok(ok(json!({ "user": user })))
}
