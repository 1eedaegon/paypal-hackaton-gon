//! Small in-memory fixed-window limiter for unauthenticated endpoints.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

const MAX_TRACKED_KEYS: usize = 50_000;

pub struct RateLimiter {
    limit: u32,
    window: Duration,
    hits: Mutex<HashMap<String, (Instant, u32)>>,
}

impl RateLimiter {
    pub fn new(limit: u32, window: Duration) -> Self {
        Self {
            limit,
            window,
            hits: Mutex::new(HashMap::new()),
        }
    }

    /// Records one attempt for `key` and reports whether it is still within the limit.
    pub fn allow(&self, key: &str) -> bool {
        self.allow_at(key, Instant::now())
    }

    fn allow_at(&self, key: &str, now: Instant) -> bool {
        let Ok(mut hits) = self.hits.lock() else {
            return false;
        };
        if hits.len() >= MAX_TRACKED_KEYS {
            hits.retain(|_, (start, _)| now.duration_since(*start) < self.window);
        }
        let entry = hits.entry(key.to_string()).or_insert((now, 0));
        if now.duration_since(entry.0) >= self.window {
            *entry = (now, 0);
        }
        entry.1 += 1;
        entry.1 <= self.limit
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_after_limit_within_window() {
        let limiter = RateLimiter::new(2, Duration::from_secs(60));
        let now = Instant::now();
        assert!(limiter.allow_at("ip", now));
        assert!(limiter.allow_at("ip", now));
        assert!(!limiter.allow_at("ip", now));
    }

    #[test]
    fn tracks_keys_independently() {
        let limiter = RateLimiter::new(1, Duration::from_secs(60));
        let now = Instant::now();
        assert!(limiter.allow_at("a", now));
        assert!(limiter.allow_at("b", now));
    }

    #[test]
    fn resets_after_window_passes() {
        let limiter = RateLimiter::new(1, Duration::from_secs(60));
        let now = Instant::now();
        assert!(limiter.allow_at("ip", now));
        assert!(!limiter.allow_at("ip", now));
        assert!(limiter.allow_at("ip", now + Duration::from_secs(61)));
    }
}
