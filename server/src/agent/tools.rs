//! The tools the model can call. Every tool is scoped to the signed-in user, and none of them
//! moves money or contacts a client without the approval rules in `service::actions`.

use std::collections::HashMap;

use chrono::{NaiveDate, Utc};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use super::gemini::FunctionCall;
use super::prompt::MAX_POLICY_LEN;
use crate::error::{AppError, AppResult};
use crate::models::{Effect, InvoiceItem, InvoiceRow, User, STATUS_SENT};
use crate::money::format_cents;
use crate::repo::activity::ACTOR_AGENT;
use crate::repo::{activity, invoices, policy};
use crate::service::actions::{propose, unescape_newlines, Proposal};
use crate::service::{describe, today};
use crate::state::AppState;
use crate::validation::{required_text, validate_invoice, InvoiceInput};

const MAX_INVOICES_FOR_MODEL: usize = 100;
const MAX_OPEN_DRAFTS: i64 = 30;

pub fn declarations() -> Value {
    json!([
        {
            "name": "draft_invoice",
            "description": "Create an invoice draft for the user to review and approve. Does not send anything.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "recipient_name": { "type": "STRING", "description": "Client person or business name" },
                    "recipient_email": { "type": "STRING", "description": "Client billing email, exactly as given by the user" },
                    "items": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "name": { "type": "STRING" },
                                "quantity": { "type": "NUMBER" },
                                "unit_price": { "type": "NUMBER", "description": "Price per unit in USD" }
                            },
                            "required": ["name", "quantity", "unit_price"]
                        }
                    },
                    "due_date": { "type": "STRING", "description": "YYYY-MM-DD" },
                    "note": { "type": "STRING", "description": "Optional short note shown to the client" }
                },
                "required": ["recipient_name", "recipient_email", "items", "due_date"]
            }
        },
        {
            "name": "list_invoices",
            "description": "List the user's invoices with payment status, days overdue and reminder history.",
            "parameters": { "type": "OBJECT", "properties": {} }
        },
        {
            "name": "propose_followup",
            "description": "Record the follow-up decision for one unpaid invoice: send a reminder or wait.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "invoice_id": { "type": "STRING", "description": "The id from list_invoices" },
                    "decision": { "type": "STRING", "enum": ["remind", "wait"] },
                    "subject": { "type": "STRING", "description": "Reminder email subject (remind only)" },
                    "message": { "type": "STRING", "description": "Reminder text to the client (remind only)" },
                    "reasoning": { "type": "STRING", "description": "Why this decision follows from the policy and the facts" }
                },
                "required": ["invoice_id", "decision", "reasoning"]
            }
        },
        {
            "name": "set_policy",
            "description": "Replace the user's collection policy with new text.",
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "text": { "type": "STRING", "description": "The complete policy in plain language" }
                },
                "required": ["text"]
            }
        }
    ])
}

#[derive(Deserialize)]
struct DraftItemArgs {
    name: String,
    quantity: f64,
    unit_price: f64,
}

#[derive(Deserialize)]
struct DraftArgs {
    recipient_name: String,
    recipient_email: String,
    items: Vec<DraftItemArgs>,
    due_date: String,
    #[serde(default)]
    note: String,
}

#[derive(Deserialize)]
struct FollowupArgs {
    invoice_id: String,
    decision: String,
    #[serde(default)]
    subject: String,
    #[serde(default)]
    message: String,
    reasoning: String,
}

#[derive(Deserialize)]
struct PolicyArgs {
    text: String,
}

fn parse_args<T: serde::de::DeserializeOwned>(args: &Value) -> AppResult<T> {
    serde_json::from_value(args.clone())
        .map_err(|err| AppError::invalid(format!("Invalid tool arguments: {err}")))
}

fn to_invoice_input(args: DraftArgs) -> AppResult<InvoiceInput> {
    let due_date = NaiveDate::parse_from_str(args.due_date.trim(), "%Y-%m-%d")
        .map_err(|_| AppError::invalid("due_date must be a calendar date in YYYY-MM-DD format."))?;
    let items = args
        .items
        .into_iter()
        .map(|item| InvoiceItem {
            name: item.name,
            quantity: item.quantity,
            unit_price: format!("{:.2}", item.unit_price),
        })
        .collect();
    Ok(InvoiceInput {
        recipient_name: args.recipient_name,
        recipient_email: args.recipient_email,
        items,
        due_date,
        note: args.note,
    })
}

async fn draft_invoice(
    state: &AppState,
    user: &User,
    args: &Value,
) -> AppResult<(Value, Option<Effect>)> {
    let input = to_invoice_input(parse_args(args)?)?;
    let valid = validate_invoice(&input, today())?;
    if invoices::count_drafts(&state.db, user.id).await? >= MAX_OPEN_DRAFTS {
        return Err(AppError::invalid(
            "There are too many unapproved drafts. Ask the user to approve or discard some first.",
        ));
    }
    let draft = invoices::insert_draft(&state.db, user.id, &valid).await?;
    let summary = format!(
        "Drafted invoice {} due {}",
        describe(&draft),
        draft.due_date
    );
    activity::log(
        &state.db,
        user.id,
        Some(draft.id),
        ACTOR_AGENT,
        "invoice_drafted",
        &summary,
    )
    .await?;
    let result = json!({
        "invoice_id": draft.id,
        "total": format_cents(draft.total_cents),
        "status": "draft, waiting for the user's approval",
    });
    Ok((
        result,
        Some(Effect::InvoiceDrafted {
            invoice_id: draft.id,
        }),
    ))
}

fn describe_for_model(invoice: &InvoiceRow, paid_by_client: &HashMap<String, i64>) -> Value {
    let days_since_reminder = invoice
        .last_reminded_at
        .map(|at| (Utc::now() - at).num_days());
    let paid_before = paid_by_client
        .get(&invoice.recipient_email)
        .copied()
        .unwrap_or(0);
    json!({
        "invoice_id": invoice.id,
        "number": invoice.number,
        "client": invoice.recipient_name,
        "client_email": invoice.recipient_email,
        "total": format_cents(invoice.total_cents),
        "due_date": invoice.due_date,
        "status": invoice.status,
        "days_overdue": invoice.days_overdue(today()),
        "days_until_due": (invoice.due_date - today()).num_days().max(0),
        "reminder_count": invoice.reminder_count,
        "days_since_last_reminder": days_since_reminder,
        "client_paid_invoices": paid_before,
    })
}

async fn list_invoices(state: &AppState, user: &User) -> AppResult<(Value, Option<Effect>)> {
    let rows = invoices::list(&state.db, user.id).await?;
    let paid_by_client = invoices::paid_counts_by_client(&state.db, user.id).await?;
    let unpaid = rows.iter().filter(|row| row.status == STATUS_SENT).count();
    // Unpaid invoices first, so the cap never hides something that needs a decision.
    let (open, closed): (Vec<&InvoiceRow>, Vec<&InvoiceRow>) =
        rows.iter().partition(|row| row.status == STATUS_SENT);
    let described: Vec<Value> = open
        .into_iter()
        .chain(closed)
        .take(MAX_INVOICES_FOR_MODEL)
        .map(|row| describe_for_model(row, &paid_by_client))
        .collect();
    Ok((
        json!({ "invoices": described, "unpaid_count": unpaid }),
        None,
    ))
}

async fn propose_followup(
    state: &AppState,
    user: &User,
    args: &Value,
) -> AppResult<(Value, Option<Effect>)> {
    let args: FollowupArgs = parse_args(args)?;
    let invoice_id = Uuid::parse_str(args.invoice_id.trim())
        .map_err(|_| AppError::invalid("invoice_id must be an id returned by list_invoices."))?;
    let auto_send = policy::get(&state.db, user.id).await?.auto_send;
    let proposal = Proposal {
        invoice_id,
        kind: args.decision,
        subject: args.subject,
        message: args.message,
        reasoning: args.reasoning,
    };
    let effect = propose(state, user.id, &proposal, auto_send).await?;
    let outcome = match (&effect, proposal.kind.as_str()) {
        (Effect::ActionExecuted { .. }, _) => "reminder sent through PayPal (auto-send is on)",
        (_, "wait") => "wait decision recorded",
        _ => "reminder drafted, waiting for the user's approval",
    };
    Ok((json!({ "outcome": outcome }), Some(effect)))
}

async fn set_policy(
    state: &AppState,
    user: &User,
    args: &Value,
) -> AppResult<(Value, Option<Effect>)> {
    let args: PolicyArgs = parse_args(args)?;
    let text = required_text(&args.text, "Policy", MAX_POLICY_LEN)?;
    // Automatic sending is the user's switch only (the Policy tab); the model cannot change it.
    let auto_send = policy::get(&state.db, user.id).await?.auto_send;
    policy::upsert(&state.db, user.id, &text, auto_send).await?;
    activity::log(
        &state.db,
        user.id,
        None,
        ACTOR_AGENT,
        "policy_updated",
        "Updated the collection policy text",
    )
    .await?;
    Ok((
        json!({ "outcome": "policy text saved. Automatic sending can only be changed by the user in the Policy tab." }),
        Some(Effect::PolicyUpdated),
    ))
}

/// Applies `unescape_newlines` to every string in the model's arguments, so text it wrote with
/// escaped line breaks is stored and sent with real ones.
fn unescape_strings(value: &Value) -> Value {
    match value {
        Value::String(text) => Value::String(unescape_newlines(text)),
        Value::Array(items) => Value::Array(items.iter().map(unescape_strings).collect()),
        Value::Object(map) => Value::Object(
            map.iter()
                .map(|(key, item)| (key.clone(), unescape_strings(item)))
                .collect(),
        ),
        other => other.clone(),
    }
}

/// Runs one tool call. Problems the model can fix (bad arguments, PayPal refusals) come back as an
/// `error` result for it to read; only internal failures abort the run.
pub async fn execute(
    state: &AppState,
    user: &User,
    call: &FunctionCall,
) -> AppResult<(Value, Option<Effect>)> {
    let args = unescape_strings(&call.args);
    let outcome = match call.name.as_str() {
        "draft_invoice" => draft_invoice(state, user, &args).await,
        "list_invoices" => list_invoices(state, user).await,
        "propose_followup" => propose_followup(state, user, &args).await,
        "set_policy" => set_policy(state, user, &args).await,
        other => Err(AppError::invalid(format!("Unknown tool \"{other}\"."))),
    };
    match outcome {
        Ok(result) => Ok(result),
        Err(AppError::Internal(err)) => Err(AppError::Internal(err)),
        Err(recoverable) => Ok((json!({ "error": recoverable.to_string() }), None)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_draft_arguments_into_invoice_input() {
        let args: DraftArgs = parse_args(&json!({
            "recipient_name": "Acme",
            "recipient_email": "billing@acme.example",
            "items": [{ "name": "Logo", "quantity": 1, "unit_price": 500 }],
            "due_date": "2026-11-26"
        }))
        .unwrap();
        let input = to_invoice_input(args).unwrap();
        assert_eq!(input.items[0].unit_price, "500.00");
        assert_eq!(
            input.due_date,
            NaiveDate::from_ymd_opt(2026, 11, 26).unwrap()
        );
    }

    #[test]
    fn rejects_draft_with_unparseable_due_date() {
        let args: DraftArgs = parse_args(&json!({
            "recipient_name": "Acme",
            "recipient_email": "billing@acme.example",
            "items": [{ "name": "Logo", "quantity": 1, "unit_price": 500 }],
            "due_date": "next Friday"
        }))
        .unwrap();
        assert!(to_invoice_input(args).is_err());
    }

    #[test]
    fn rejects_arguments_missing_required_fields() {
        assert!(parse_args::<FollowupArgs>(&json!({ "invoice_id": "x" })).is_err());
    }

    #[test]
    fn unescapes_line_breaks_in_nested_tool_arguments() {
        let cleaned = unescape_strings(&json!({
            "message": "Hi,\\n\\nThanks",
            "items": [{ "name": "A\\nB", "quantity": 1 }]
        }));
        assert_eq!(cleaned["message"], "Hi,\n\nThanks");
        assert_eq!(cleaned["items"][0]["name"], "A\nB");
        assert_eq!(cleaned["items"][0]["quantity"], 1);
    }

    #[test]
    fn declares_all_four_tools() {
        let names: Vec<String> = declarations()
            .as_array()
            .unwrap()
            .iter()
            .map(|d| d["name"].as_str().unwrap().to_string())
            .collect();
        assert_eq!(
            names,
            [
                "draft_invoice",
                "list_invoices",
                "propose_followup",
                "set_policy"
            ]
        );
    }
}
