//! Minimal PayPal REST client: OAuth token caching plus the Invoicing and Webhooks calls Duely needs.

pub mod invoicing;
pub mod webhook;

use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::Context;
use reqwest::{Method, RequestBuilder, Response, StatusCode};
use serde::Deserialize;
use serde_json::Value;
use tokio::sync::Mutex;

use crate::config::Config;
use crate::error::{AppError, AppResult};

const REQUEST_TIMEOUT: Duration = Duration::from_secs(25);
const TOKEN_EXPIRY_MARGIN: Duration = Duration::from_secs(120);

#[derive(Clone)]
pub struct PayPal {
    http: reqwest::Client,
    base: String,
    client_id: String,
    client_secret: String,
    token: Arc<Mutex<Option<(String, Instant)>>>,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: u64,
}

#[derive(Deserialize, Default)]
struct ErrorBody {
    #[serde(default)]
    message: String,
    #[serde(default)]
    details: Vec<ErrorDetail>,
}

#[derive(Deserialize)]
struct ErrorDetail {
    #[serde(default)]
    description: String,
}

impl PayPal {
    pub fn new(cfg: &Config) -> anyhow::Result<Self> {
        let http = reqwest::Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .build()
            .context("building PayPal HTTP client")?;
        Ok(Self {
            http,
            base: cfg.paypal_base.clone(),
            client_id: cfg.paypal_client_id.clone(),
            client_secret: cfg.paypal_client_secret.clone(),
            token: Arc::new(Mutex::new(None)),
        })
    }

    async fn access_token(&self) -> AppResult<String> {
        let mut cached = self.token.lock().await;
        if let Some((token, expires_at)) = cached.as_ref() {
            if Instant::now() < *expires_at {
                return Ok(token.clone());
            }
        }
        let response = self
            .http
            .post(format!("{}/v1/oauth2/token", self.base))
            .basic_auth(&self.client_id, Some(&self.client_secret))
            .form(&[("grant_type", "client_credentials")])
            .send()
            .await
            .map_err(network_error)?;
        let response = check(response).await?;
        let body: TokenResponse = response.json().await.map_err(network_error)?;
        let lifetime = Duration::from_secs(body.expires_in).saturating_sub(TOKEN_EXPIRY_MARGIN);
        *cached = Some((body.access_token.clone(), Instant::now() + lifetime));
        Ok(body.access_token)
    }

    async fn request(&self, method: Method, path: &str) -> AppResult<RequestBuilder> {
        let token = self.access_token().await?;
        Ok(self
            .http
            .request(method, format!("{}{}", self.base, path))
            .bearer_auth(token))
    }

    /// Sends a JSON request and returns the parsed body (`Null` for empty responses).
    async fn call(&self, method: Method, path: &str, body: Option<&Value>) -> AppResult<Value> {
        let builder = self
            .request(method, path)
            .await?
            .header("Prefer", "return=representation");
        let builder = match body {
            Some(json) => builder.json(json),
            None => builder.header("Content-Type", "application/json"),
        };
        let response = check(builder.send().await.map_err(network_error)?).await?;
        if response.status() == StatusCode::NO_CONTENT {
            return Ok(Value::Null);
        }
        let text = response.text().await.map_err(network_error)?;
        if text.trim().is_empty() {
            return Ok(Value::Null);
        }
        serde_json::from_str(&text).map_err(|err| {
            AppError::Internal(anyhow::anyhow!("PayPal returned invalid JSON: {err}"))
        })
    }
}

fn network_error(err: reqwest::Error) -> AppError {
    tracing::warn!(error = %err, "PayPal request failed");
    AppError::Upstream("Could not reach PayPal. Please try again in a moment.".into())
}

/// Turns a non-2xx PayPal response into an error whose message is safe to show.
async fn check(response: Response) -> AppResult<Response> {
    let status = response.status();
    if status.is_success() {
        return Ok(response);
    }
    let text = response.text().await.unwrap_or_default();
    tracing::warn!(%status, body = %text, "PayPal returned an error");
    let parsed: ErrorBody = serde_json::from_str(&text).unwrap_or_default();
    let reason = parsed
        .details
        .into_iter()
        .map(|d| d.description)
        .find(|d| !d.is_empty())
        .or(Some(parsed.message).filter(|m| !m.is_empty()))
        .unwrap_or_else(|| format!("HTTP {}", status.as_u16()));
    Err(AppError::Upstream(format!(
        "PayPal could not complete this: {reason}"
    )))
}
