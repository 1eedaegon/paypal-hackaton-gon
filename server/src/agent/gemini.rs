//! Gemini `generateContent` client with function calling and model fallback.

use std::sync::Arc;
use std::time::Duration;

use anyhow::Context;
use reqwest::StatusCode;
use serde_json::{json, Value};

use crate::config::Config;
use crate::error::{AppError, AppResult};

const API_BASE: &str = "https://generativelanguage.googleapis.com/v1beta/models";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);
const BUSY_MESSAGE: &str = "The AI model is busy right now. Please try again in a moment.";

#[derive(Clone)]
pub struct Gemini {
    http: reqwest::Client,
    key: String,
    models: Arc<Vec<String>>,
}

/// One function call requested by the model.
#[derive(Debug, Clone, PartialEq)]
pub struct FunctionCall {
    pub name: String,
    pub args: Value,
    pub id: Option<String>,
}

/// One model turn: the raw content (to append to the history unchanged) and what it contains.
#[derive(Debug, Clone)]
pub struct ModelTurn {
    pub content: Value,
    pub text: String,
    pub calls: Vec<FunctionCall>,
}

enum Attempt {
    Done(ModelTurn),
    /// Overloaded, rate limited or timed out: worth trying the next model.
    Retryable,
}

impl Gemini {
    pub fn new(cfg: &Config) -> anyhow::Result<Self> {
        if cfg.gemini_models.is_empty() {
            anyhow::bail!("GEMINI_MODELS must name at least one model");
        }
        let http = reqwest::Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .build()
            .context("building Gemini HTTP client")?;
        Ok(Self {
            http,
            key: cfg.gemini_key.clone(),
            models: Arc::new(cfg.gemini_models.clone()),
        })
    }

    /// Asks the first model that responds. Falls back to the next one when a model is overloaded.
    pub async fn generate(
        &self,
        system: &str,
        contents: &[Value],
        declarations: &Value,
    ) -> AppResult<ModelTurn> {
        let body = json!({
            "systemInstruction": { "parts": [{ "text": system }] },
            "contents": contents,
            "tools": [{ "functionDeclarations": declarations }],
        });
        for model in self.models.iter() {
            match self.attempt(model, &body).await? {
                Attempt::Done(turn) => return Ok(turn),
                Attempt::Retryable => {
                    tracing::warn!(%model, "Gemini model unavailable, trying next")
                }
            }
        }
        Err(AppError::Upstream(BUSY_MESSAGE.into()))
    }

    async fn attempt(&self, model: &str, body: &Value) -> AppResult<Attempt> {
        let url = format!("{API_BASE}/{model}:generateContent");
        let response = match self
            .http
            .post(url)
            .header("x-goog-api-key", &self.key)
            .json(body)
            .send()
            .await
        {
            Ok(response) => response,
            Err(err) => {
                tracing::warn!(error = %err.without_url(), %model, "Gemini request failed");
                return Ok(Attempt::Retryable);
            }
        };
        let status = response.status();
        if status == StatusCode::TOO_MANY_REQUESTS || status.is_server_error() {
            return Ok(Attempt::Retryable);
        }
        let text = response.text().await.unwrap_or_default();
        if !status.is_success() {
            tracing::error!(%status, body = %text, %model, "Gemini rejected the request");
            return Err(AppError::Upstream(
                "The AI model could not process this request.".into(),
            ));
        }
        let value: Value = serde_json::from_str(&text).context("Gemini returned invalid JSON")?;
        parse_turn(&value).map(Attempt::Done)
    }
}

fn parse_turn(response: &Value) -> AppResult<ModelTurn> {
    let content = &response["candidates"][0]["content"];
    let parts = content["parts"]
        .as_array()
        .filter(|parts| !parts.is_empty())
        .ok_or_else(|| {
            let reason = response["candidates"][0]["finishReason"].as_str().unwrap_or("unknown");
            tracing::warn!(%reason, "Gemini returned no content");
            AppError::Upstream(
                "The AI model returned an empty answer. Please rephrase and try again.".into(),
            )
        })?;
    let text = parts
        .iter()
        .filter(|part| part["thought"].as_bool() != Some(true))
        .filter_map(|part| part["text"].as_str())
        .collect::<Vec<_>>()
        .join("")
        .trim()
        .to_string();
    let calls = parts
        .iter()
        .filter_map(|part| {
            let call = part.get("functionCall")?;
            Some(FunctionCall {
                name: call["name"].as_str()?.to_string(),
                args: call.get("args").cloned().unwrap_or_else(|| json!({})),
                id: call["id"].as_str().map(str::to_string),
            })
        })
        .collect();
    Ok(ModelTurn {
        content: content.clone(),
        text,
        calls,
    })
}

/// The history entry that answers the model's function calls.
pub fn function_responses(results: &[(FunctionCall, Value)]) -> Value {
    let parts: Vec<Value> = results
        .iter()
        .map(|(call, result)| {
            let base = json!({ "name": call.name, "response": { "result": result } });
            let response = match &call.id {
                Some(id) => json!({ "id": id, "name": base["name"], "response": base["response"] }),
                None => base,
            };
            json!({ "functionResponse": response })
        })
        .collect();
    json!({ "role": "user", "parts": parts })
}

pub fn text_content(role: &str, text: &str) -> Value {
    json!({ "role": role, "parts": [{ "text": text }] })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_text_and_function_calls_and_skips_thoughts() {
        let response = json!({ "candidates": [{ "content": { "role": "model", "parts": [
            { "text": "internal", "thought": true },
            { "text": "Drafting it now." },
            { "functionCall": { "name": "draft_invoice", "args": { "recipient_name": "Acme" }, "id": "call-1" } }
        ] } }] });
        let turn = parse_turn(&response).unwrap();
        assert_eq!(turn.text, "Drafting it now.");
        assert_eq!(turn.calls.len(), 1);
        assert_eq!(turn.calls[0].name, "draft_invoice");
        assert_eq!(turn.calls[0].id.as_deref(), Some("call-1"));
        assert_eq!(turn.content["role"], "model");
    }

    #[test]
    fn rejects_response_without_candidates() {
        assert!(parse_turn(&json!({ "promptFeedback": { "blockReason": "SAFETY" } })).is_err());
    }

    #[test]
    fn builds_function_responses_with_matching_ids() {
        let call = FunctionCall {
            name: "list_invoices".into(),
            args: json!({}),
            id: Some("call-9".into()),
        };
        let content = function_responses(&[(call, json!({ "invoices": [] }))]);
        let response = &content["parts"][0]["functionResponse"];
        assert_eq!(content["role"], "user");
        assert_eq!(response["id"], "call-9");
        assert_eq!(response["name"], "list_invoices");
        assert_eq!(response["response"]["result"]["invoices"], json!([]));
    }
}
