use axum::http::HeaderMap;
use reqwest::Method;
use serde_json::Value;

use super::{check, network_error, PayPal};
use crate::error::AppResult;

const SIGNATURE_HEADERS: [(&str, &str); 5] = [
    ("auth_algo", "paypal-auth-algo"),
    ("cert_url", "paypal-cert-url"),
    ("transmission_id", "paypal-transmission-id"),
    ("transmission_sig", "paypal-transmission-sig"),
    ("transmission_time", "paypal-transmission-time"),
];

/// Builds the verify-webhook-signature request body. The event is embedded as the raw
/// bytes PayPal sent, because re-serializing it can change the signed content.
fn verification_body(headers: &HeaderMap, webhook_id: &str, raw_event: &str) -> Option<String> {
    let fields = SIGNATURE_HEADERS
        .iter()
        .map(|(field, header)| {
            let value = headers.get(*header)?.to_str().ok()?;
            Some(format!("{}:{}", Value::from(*field), Value::from(value)))
        })
        .collect::<Option<Vec<_>>>()?;
    Some(format!(
        "{{{},\"webhook_id\":{},\"webhook_event\":{}}}",
        fields.join(","),
        Value::from(webhook_id),
        raw_event
    ))
}

impl PayPal {
    /// Asks PayPal whether this webhook delivery was really signed by PayPal for our webhook.
    pub async fn verify_webhook(
        &self,
        headers: &HeaderMap,
        webhook_id: &str,
        raw_event: &str,
    ) -> AppResult<bool> {
        let Some(body) = verification_body(headers, webhook_id, raw_event) else {
            return Ok(false);
        };
        let response = self
            .request(Method::POST, "/v1/notifications/verify-webhook-signature")
            .await?
            .header("Content-Type", "application/json")
            .body(body)
            .send()
            .await
            .map_err(network_error)?;
        let value: Value = check(response).await?.json().await.map_err(network_error)?;
        Ok(value["verification_status"].as_str() == Some("SUCCESS"))
    }
}

/// The PayPal invoice id an invoicing webhook event refers to.
pub fn invoice_id_of(event: &Value) -> Option<&str> {
    let resource = &event["resource"];
    resource["invoice"]["id"]
        .as_str()
        .or_else(|| resource["id"].as_str())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn headers() -> HeaderMap {
        let mut map = HeaderMap::new();
        for (_, header) in SIGNATURE_HEADERS {
            map.insert(header, "value".parse().unwrap());
        }
        map
    }

    #[test]
    fn embeds_raw_event_unchanged_in_verification_body() {
        let raw = r#"{"id":"WH-1",  "resource":{"invoice":{"id":"INV2-X"}}}"#;
        let body = verification_body(&headers(), "WEBHOOK", raw).unwrap();
        assert!(body.contains(raw));
        let parsed: Value = serde_json::from_str(&body).unwrap();
        assert_eq!(parsed["webhook_id"], "WEBHOOK");
        assert_eq!(parsed["transmission_id"], "value");
    }

    #[test]
    fn refuses_to_build_body_when_signature_headers_are_missing() {
        assert!(verification_body(&HeaderMap::new(), "WEBHOOK", "{}").is_none());
    }

    #[test]
    fn finds_invoice_id_in_both_resource_shapes() {
        assert_eq!(
            invoice_id_of(&json!({ "resource": { "invoice": { "id": "INV2-A" } } })),
            Some("INV2-A")
        );
        assert_eq!(
            invoice_id_of(&json!({ "resource": { "id": "INV2-B" } })),
            Some("INV2-B")
        );
        assert_eq!(invoice_id_of(&json!({ "resource": {} })), None);
    }
}
