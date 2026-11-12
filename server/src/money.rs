//! Money is stored as integer cents and exchanged as decimal strings ("500.00").

const CENTS_PER_UNIT: i64 = 100;

pub fn format_cents(cents: i64) -> String {
    let sign = if cents < 0 { "-" } else { "" };
    let abs = cents.abs();
    format!("{sign}{}.{:02}", abs / CENTS_PER_UNIT, abs % CENTS_PER_UNIT)
}

/// Parses a non-negative decimal amount with at most two fraction digits.
pub fn parse_cents(input: &str) -> Option<i64> {
    let cleaned = input.trim().trim_start_matches('$').replace(',', "");
    let (whole, fraction) = match cleaned.split_once('.') {
        Some((w, f)) => (w, f),
        None => (cleaned.as_str(), ""),
    };
    if whole.is_empty() && fraction.is_empty() {
        return None;
    }
    if fraction.len() > 2
        || !whole.chars().all(|c| c.is_ascii_digit())
        || !fraction.chars().all(|c| c.is_ascii_digit())
    {
        return None;
    }
    let whole_value: i64 = if whole.is_empty() {
        0
    } else {
        whole.parse().ok()?
    };
    let fraction_value: i64 = match fraction.len() {
        0 => 0,
        1 => fraction.parse::<i64>().ok()? * 10,
        _ => fraction.parse().ok()?,
    };
    whole_value
        .checked_mul(CENTS_PER_UNIT)?
        .checked_add(fraction_value)
}

/// Line total for a fractional quantity, rounded to the nearest cent.
pub fn line_total_cents(quantity: f64, unit_cents: i64) -> i64 {
    (quantity * unit_cents as f64).round() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_cents_with_two_fraction_digits() {
        assert_eq!(format_cents(50000), "500.00");
        assert_eq!(format_cents(5), "0.05");
        assert_eq!(format_cents(123456), "1234.56");
    }

    #[test]
    fn parses_plain_and_decorated_amounts() {
        assert_eq!(parse_cents("500"), Some(50000));
        assert_eq!(parse_cents("500.5"), Some(50050));
        assert_eq!(parse_cents("$1,234.56"), Some(123456));
        assert_eq!(parse_cents(" 0.05 "), Some(5));
    }

    #[test]
    fn rejects_malformed_amounts() {
        assert_eq!(parse_cents(""), None);
        assert_eq!(parse_cents("-5"), None);
        assert_eq!(parse_cents("1.234"), None);
        assert_eq!(parse_cents("abc"), None);
        assert_eq!(parse_cents("1e3"), None);
    }

    #[test]
    fn rounds_fractional_quantity_line_totals() {
        assert_eq!(line_total_cents(2.5, 4000), 10000);
        assert_eq!(line_total_cents(0.333, 100), 33);
    }
}
