use anyhow::{anyhow, Result};
use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use tokio::sync::Semaphore;

fn hash_blocking(password: &str) -> Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|err| anyhow!("password hashing failed: {err}"))
}

fn verify_blocking(password: &str, stored_hash: &str) -> bool {
    PasswordHash::new(stored_hash)
        .map(|parsed| {
            Argon2::default()
                .verify_password(password.as_bytes(), &parsed)
                .is_ok()
        })
        .unwrap_or(false)
}

/// Argon2 is CPU and memory heavy: it runs off the async executor, a few at a time.
pub async fn hash(permits: &Semaphore, password: String) -> Result<String> {
    let _permit = permits.acquire().await?;
    tokio::task::spawn_blocking(move || hash_blocking(&password)).await?
}

pub async fn verify(permits: &Semaphore, password: String, stored_hash: String) -> Result<bool> {
    let _permit = permits.acquire().await?;
    Ok(tokio::task::spawn_blocking(move || verify_blocking(&password, &stored_hash)).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verifies_the_password_it_hashed() {
        let hash = hash_blocking("correct horse").unwrap();
        assert!(verify_blocking("correct horse", &hash));
    }

    #[test]
    fn rejects_wrong_password_and_garbage_hash() {
        let hash = hash_blocking("correct horse").unwrap();
        assert!(!verify_blocking("wrong horse", &hash));
        assert!(!verify_blocking("correct horse", "not-a-hash"));
    }
}
