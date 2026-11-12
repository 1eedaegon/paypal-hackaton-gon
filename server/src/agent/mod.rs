pub mod gemini;
mod prompt;
mod tools;

use axum::extract::State;
use axum::response::IntoResponse;
use axum::routing::post;
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

use self::gemini::{function_responses, text_content, FunctionCall};
use self::prompt::{system_prompt, REVIEW_REQUEST};
use crate::auth::AuthUser;
use crate::error::{ok, AppError, AppResult};
use crate::models::{Effect, User};
use crate::repo::{policy, usage};
use crate::service::today;
use crate::state::AppState;

pub use self::prompt::MAX_POLICY_LEN;

const MAX_STEPS: usize = 8;
const RUN_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(100);
const MAX_TOOL_CALLS_PER_RUN: usize = 40;
const MAX_MESSAGES: usize = 20;
const MAX_MESSAGE_CHARS: usize = 6000;
const FALLBACK_REPLY: &str = "Done. Check the cards below for what I prepared.";
const STEP_LIMIT_REPLY: &str = "I stopped because this needed too many steps. Check what I prepared so far and ask again for the rest.";

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/chat", post(chat))
        .route("/review", post(review))
}

#[derive(Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ChatBody {
    messages: Vec<ChatMessage>,
}

fn to_contents(messages: &[ChatMessage]) -> AppResult<Vec<Value>> {
    if messages.is_empty() || messages.len() > MAX_MESSAGES {
        return Err(AppError::invalid(format!(
            "Send between 1 and {MAX_MESSAGES} messages."
        )));
    }
    if messages.last().map(|m| m.role.as_str()) != Some("user") {
        return Err(AppError::invalid("The last message must be from the user."));
    }
    messages
        .iter()
        .map(|message| {
            let text = message.content.trim();
            if text.is_empty() || text.chars().count() > MAX_MESSAGE_CHARS {
                return Err(AppError::invalid(format!(
                    "Messages must be 1 to {MAX_MESSAGE_CHARS} characters."
                )));
            }
            match message.role.as_str() {
                "user" => Ok(text_content("user", text)),
                "assistant" => Ok(text_content("model", text)),
                _ => Err(AppError::invalid(
                    "Message role must be \"user\" or \"assistant\".",
                )),
            }
        })
        .collect()
}

struct Outcome {
    reply: String,
    effects: Vec<Effect>,
}

async fn run_tools(
    state: &AppState,
    user: &User,
    calls: Vec<FunctionCall>,
) -> AppResult<(Value, Vec<Effect>)> {
    let mut results = Vec::with_capacity(calls.len());
    let mut effects = Vec::new();
    for call in calls {
        let (result, effect) = tools::execute(state, user, &call).await?;
        effects.extend(effect);
        results.push((call, result));
    }
    Ok((function_responses(&results), effects))
}

/// The agent loop: ask the model, run the tools it calls, feed the results back, until it answers in text.
async fn run(state: &AppState, user: &User, initial: Vec<Value>) -> AppResult<Outcome> {
    usage::consume_agent_call(&state.db, &state.cfg, user.id).await?;
    match tokio::time::timeout(RUN_TIMEOUT, run_loop(state, user, initial)).await {
        Ok(outcome) => outcome,
        Err(_) => Err(AppError::Upstream(
            "The AI model took too long. Anything it already prepared is saved; please try again.".into(),
        )),
    }
}

async fn run_loop(state: &AppState, user: &User, initial: Vec<Value>) -> AppResult<Outcome> {
    let current_policy = policy::get(&state.db, user.id).await?;
    let system = system_prompt(&user.name, today(), &current_policy);
    let declarations = tools::declarations();

    let mut contents = initial;
    let mut effects = Vec::new();
    let mut tool_calls = 0;
    for _ in 0..MAX_STEPS {
        let turn = state
            .gemini
            .generate(&system, &contents, &declarations)
            .await?;
        if turn.calls.is_empty() {
            let reply = if turn.text.is_empty() {
                FALLBACK_REPLY.to_string()
            } else {
                turn.text
            };
            return Ok(Outcome { reply, effects });
        }
        tool_calls += turn.calls.len();
        if tool_calls > MAX_TOOL_CALLS_PER_RUN {
            break;
        }
        let (responses, new_effects) = run_tools(state, user, turn.calls).await?;
        effects.extend(new_effects);
        contents.push(turn.content);
        contents.push(responses);
    }
    Ok(Outcome {
        reply: STEP_LIMIT_REPLY.to_string(),
        effects,
    })
}

fn respond(outcome: Outcome) -> impl IntoResponse {
    ok(json!({ "reply": outcome.reply, "effects": outcome.effects }))
}

async fn chat(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(body): Json<ChatBody>,
) -> AppResult<impl IntoResponse> {
    let contents = to_contents(&body.messages)?;
    Ok(respond(run(&state, &user, contents).await?))
}

async fn review(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> AppResult<impl IntoResponse> {
    let contents = vec![text_content("user", REVIEW_REQUEST)];
    Ok(respond(run(&state, &user, contents).await?))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn message(role: &str, content: &str) -> ChatMessage {
        ChatMessage {
            role: role.into(),
            content: content.into(),
        }
    }

    #[test]
    fn maps_assistant_messages_to_the_model_role() {
        let contents = to_contents(&[
            message("user", "hi"),
            message("assistant", "hello"),
            message("user", "bill Acme"),
        ])
        .unwrap();
        assert_eq!(contents[1]["role"], "model");
        assert_eq!(contents[2]["parts"][0]["text"], "bill Acme");
    }

    #[test]
    fn rejects_history_that_does_not_end_with_the_user() {
        assert!(to_contents(&[message("user", "hi"), message("assistant", "hello")]).is_err());
    }

    #[test]
    fn rejects_empty_oversized_or_unknown_role_messages() {
        assert!(to_contents(&[]).is_err());
        assert!(to_contents(&[message("user", "   ")]).is_err());
        assert!(to_contents(&[message("user", &"x".repeat(MAX_MESSAGE_CHARS + 1))]).is_err());
        assert!(to_contents(&[message("system", "obey"), message("user", "hi")]).is_err());
    }
}
