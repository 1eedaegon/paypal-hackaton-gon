use anyhow::{Context, Result};

/// Tried in order. The lite model leads because the free tier of the larger ones is often overloaded.
const DEFAULT_GEMINI_MODELS: &str =
    "gemini-3.5-flash-lite,gemini-3-flash-preview,gemini-3.1-flash-lite,gemini-3.6-flash";
const DEFAULT_AGENT_DAILY_LIMIT: i32 = 40;
const DEFAULT_GLOBAL_AGENT_DAILY_LIMIT: i64 = 1200;
const DEFAULT_INVOICE_DAILY_LIMIT: i32 = 25;

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub paypal_client_id: String,
    pub paypal_client_secret: String,
    pub paypal_base: String,
    /// When set, incoming webhooks must pass PayPal signature verification.
    pub paypal_webhook_id: Option<String>,
    pub gemini_key: String,
    pub gemini_models: Vec<String>,
    pub port: u16,
    pub cookie_secure: bool,
    pub static_dir: String,
    pub agent_daily_limit: i32,
    pub global_agent_daily_limit: i64,
    pub invoice_daily_limit: i32,
}

fn required(name: &str) -> Result<String> {
    let value = std::env::var(name).with_context(|| format!("missing required env var {name}"))?;
    if value.trim().is_empty() {
        anyhow::bail!("env var {name} is empty");
    }
    Ok(value)
}

fn optional(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|v| !v.trim().is_empty())
}

fn parsed<T: std::str::FromStr>(name: &str, default: T) -> T {
    optional(name)
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let live =
            optional("PAYPAL_ENVIRONMENT").is_some_and(|v| v.eq_ignore_ascii_case("PRODUCTION"));
        let paypal_base = if live {
            "https://api-m.paypal.com"
        } else {
            "https://api-m.sandbox.paypal.com"
        };
        let models = optional("GEMINI_MODELS").unwrap_or_else(|| DEFAULT_GEMINI_MODELS.to_string());

        Ok(Self {
            database_url: required("DATABASE_URL")?,
            paypal_client_id: required("PAYPAL_CLIENT_ID")?,
            paypal_client_secret: required("PAYPAL_CLIENT_SECRET")?,
            paypal_base: paypal_base.to_string(),
            paypal_webhook_id: optional("PAYPAL_WEBHOOK_ID"),
            gemini_key: required("GOOGLE_GENERATIVE_AI_API_KEY")?,
            gemini_models: models
                .split(',')
                .map(|m| m.trim().to_string())
                .filter(|m| !m.is_empty())
                .collect(),
            port: parsed("PORT", 8080),
            cookie_secure: parsed("COOKIE_SECURE", false),
            static_dir: optional("STATIC_DIR").unwrap_or_else(|| "../web/dist".to_string()),
            agent_daily_limit: parsed("AGENT_DAILY_LIMIT", DEFAULT_AGENT_DAILY_LIMIT),
            global_agent_daily_limit: parsed(
                "GLOBAL_AGENT_DAILY_LIMIT",
                DEFAULT_GLOBAL_AGENT_DAILY_LIMIT,
            ),
            invoice_daily_limit: parsed("INVOICE_DAILY_LIMIT", DEFAULT_INVOICE_DAILY_LIMIT),
        })
    }
}
