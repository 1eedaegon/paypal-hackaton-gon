import type { ISODate, ISODateTime, Money } from "./types";

const CENTS_PER_UNIT = 100;
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** "500.00" -> 50000. Returns null when the string is not a plain non-negative decimal. */
export function toCents(amount: Money): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!match) {
    return null;
  }
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  return whole * CENTS_PER_UNIT + fraction;
}

export function centsToMoney(cents: number): Money {
  return (cents / CENTS_PER_UNIT).toFixed(2);
}

export function formatCents(cents: number): string {
  return usd.format(cents / CENTS_PER_UNIT);
}

/** Formats a contract Money string as USD. Unparseable input falls back to the raw string. */
export function formatMoney(amount: Money): string {
  const cents = toCents(amount);
  return cents === null ? amount : formatCents(cents);
}

/** Parses "2026-11-12" as a local calendar date so it never shifts across time zones. */
export function parseISODate(value: ISODate): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toISODate(date: Date): ISODate {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDay(date: Date, now: Date): string {
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

/** "Nov 3", or "Nov 3, 2025" when the year differs from the current one. */
export function formatDate(value: ISODate, now: Date = new Date()): string {
  const date = parseISODate(value);
  return date ? formatDay(date, now) : value;
}

/** "Nov 3, 2:14 PM" */
export function formatDateTime(value: ISODateTime, now: Date = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${formatDay(date, now)}, ${time}`;
}

/** "just now", "5 min ago", "3 hr ago", then falls back to a date and time. */
export function formatRelativeTime(value: ISODateTime, now: Date = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const minutes = Math.floor((now.getTime() - date.getTime()) / MS_PER_MINUTE);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < MINUTES_PER_HOUR) {
    return `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  return hours < HOURS_PER_DAY ? `${hours} hr ago` : formatDateTime(value, now);
}

export function formatDaysOverdue(days: number): string {
  return days === 1 ? "1 day overdue" : `${days} days overdue`;
}

export function pluralize(count: number, singular: string, plural: string = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
