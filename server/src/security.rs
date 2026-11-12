//! Cross-cutting HTTP protections: a same-origin check for state-changing API calls and response headers.

use axum::extract::Request;
use axum::http::header::{HeaderName, HeaderValue, HOST, ORIGIN};
use axum::http::{HeaderMap, Method};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};

use crate::error::AppError;

const WEBHOOK_PATH_SUFFIX: &str = "/webhooks/paypal";
const CONTENT_SECURITY_POLICY: &str = "default-src 'self'; script-src 'self'; \
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; \
img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

const MAX_CLIENT_KEY_LEN: usize = 64;

/// The caller's address for rate limiting. The platform proxy sets `cf-connecting-ip` and appends
/// the real peer as the last `x-forwarded-for` entry; earlier entries are client-controlled.
pub fn client_key(headers: &HeaderMap) -> String {
    let header = |name: &str| headers.get(name).and_then(|v| v.to_str().ok());
    let address = header("cf-connecting-ip")
        .or_else(|| header("x-forwarded-for").and_then(|list| list.rsplit(',').next()))
        .map(str::trim)
        .filter(|address| !address.is_empty())
        .unwrap_or("local");
    address.chars().take(MAX_CLIENT_KEY_LEN).collect()
}

/// True when the browser-sent Origin names the same host the request was addressed to.
fn origin_matches_host(headers: &HeaderMap) -> bool {
    let Some(origin) = headers.get(ORIGIN).and_then(|v| v.to_str().ok()) else {
        // Non-browser clients send no Origin; cookies are SameSite=Lax, so there is nothing to forge.
        return true;
    };
    let host = headers
        .get(HOST)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default();
    let origin_host = origin
        .split_once("://")
        .map(|(_, rest)| rest)
        .unwrap_or(origin);
    !host.is_empty() && origin_host.eq_ignore_ascii_case(host)
}

/// Rejects cross-site state-changing requests (CSRF defence in depth on top of SameSite cookies).
pub async fn same_origin(request: Request, next: Next) -> Response {
    let safe_method = matches!(
        *request.method(),
        Method::GET | Method::HEAD | Method::OPTIONS
    );
    let is_webhook = request.uri().path().ends_with(WEBHOOK_PATH_SUFFIX);
    if safe_method || is_webhook || origin_matches_host(request.headers()) {
        return next.run(request).await;
    }
    AppError::invalid("Cross-site requests are not allowed.").into_response()
}

pub async fn headers(request: Request, next: Next) -> Response {
    let is_api = request.uri().path().starts_with("/api/");
    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    if is_api {
        headers.insert(
            HeaderName::from_static("cache-control"),
            HeaderValue::from_static("no-store"),
        );
    }
    let fixed = [
        ("x-content-type-options", "nosniff"),
        ("x-frame-options", "DENY"),
        ("referrer-policy", "strict-origin-when-cross-origin"),
        ("content-security-policy", CONTENT_SECURITY_POLICY),
    ];
    for (name, value) in fixed {
        headers.insert(
            HeaderName::from_static(name),
            HeaderValue::from_static(value),
        );
    }
    response
}

#[cfg(test)]
mod tests {
    use super::*;

    fn headers_with(origin: Option<&str>, host: &str) -> HeaderMap {
        let mut map = HeaderMap::new();
        map.insert(HOST, host.parse().unwrap());
        if let Some(origin) = origin {
            map.insert(ORIGIN, origin.parse().unwrap());
        }
        map
    }

    #[test]
    fn accepts_matching_origin_and_missing_origin() {
        assert!(origin_matches_host(&headers_with(
            Some("https://duely.example"),
            "duely.example"
        )));
        assert!(origin_matches_host(&headers_with(
            Some("http://localhost:8080"),
            "localhost:8080"
        )));
        assert!(origin_matches_host(&headers_with(None, "duely.example")));
    }

    #[test]
    fn client_key_ignores_spoofable_leading_forwarded_entries() {
        let mut map = HeaderMap::new();
        map.insert("x-forwarded-for", "6.6.6.6, 203.0.113.9".parse().unwrap());
        assert_eq!(client_key(&map), "203.0.113.9");
        map.insert("cf-connecting-ip", "198.51.100.4".parse().unwrap());
        assert_eq!(client_key(&map), "198.51.100.4");
    }

    #[test]
    fn client_key_falls_back_and_is_length_capped() {
        assert_eq!(client_key(&HeaderMap::new()), "local");
        let mut map = HeaderMap::new();
        map.insert("cf-connecting-ip", "9".repeat(500).parse().unwrap());
        assert_eq!(client_key(&map).len(), MAX_CLIENT_KEY_LEN);
    }

    #[test]
    fn rejects_foreign_origin() {
        assert!(!origin_matches_host(&headers_with(
            Some("https://evil.example"),
            "duely.example"
        )));
        assert!(!origin_matches_host(&headers_with(
            Some("null"),
            "duely.example"
        )));
    }
}
