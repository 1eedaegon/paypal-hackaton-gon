import { describe, expect, test } from "vitest";
import {
  centsToMoney,
  formatDate,
  formatDaysOverdue,
  formatMoney,
  formatRelativeTime,
  parseISODate,
  pluralize,
  toCents,
} from "./format";

describe("money", () => {
  test("formats a contract money string as US dollars with thousands separators", () => {
    expect(formatMoney("1234.5")).toBe("$1,234.50");
    expect(formatMoney("500.00")).toBe("$500.00");
    expect(formatMoney("0")).toBe("$0.00");
  });

  test("returns the raw value instead of NaN when the amount cannot be parsed", () => {
    expect(formatMoney("n/a")).toBe("n/a");
  });

  test("converts decimal strings to integer cents without float drift", () => {
    expect(toCents("19.99")).toBe(1999);
    expect(toCents("0.1")).toBe(10);
    expect(toCents("1200")).toBe(120000);
  });

  test("rejects negative, over-precise and non-numeric amounts", () => {
    expect(toCents("-5")).toBeNull();
    expect(toCents("1.999")).toBeNull();
    expect(toCents("")).toBeNull();
    expect(toCents("12abc")).toBeNull();
  });

  test("turns cents back into a two-decimal money string", () => {
    expect(centsToMoney(1999)).toBe("19.99");
    expect(centsToMoney(120000)).toBe("1200.00");
  });
});

describe("dates", () => {
  const now = new Date(2026, 10, 12, 12, 0, 0);

  test("shows month and day for a date in the current year", () => {
    expect(formatDate("2026-11-03", now)).toBe("Nov 3");
  });

  test("adds the year when the date is in a different year", () => {
    expect(formatDate("2025-12-31", now)).toBe("Dec 31, 2025");
  });

  test("parses an ISO date as a local calendar day so it never shifts by time zone", () => {
    const parsed = parseISODate("2026-11-03");
    expect(parsed?.getDate()).toBe(3);
    expect(parsed?.getMonth()).toBe(10);
  });

  test("returns null for something that is not an ISO date", () => {
    expect(parseISODate("next friday")).toBeNull();
    expect(parseISODate("")).toBeNull();
  });

  test("describes recent times relatively", () => {
    expect(formatRelativeTime(new Date(now.getTime() - 20_000).toISOString(), now)).toBe("just now");
    expect(formatRelativeTime(new Date(now.getTime() - 5 * 60_000).toISOString(), now)).toBe("5 min ago");
    expect(formatRelativeTime(new Date(now.getTime() - 3 * 3_600_000).toISOString(), now)).toBe("3 hr ago");
  });

  test("uses singular and plural day counts for overdue text", () => {
    expect(formatDaysOverdue(1)).toBe("1 day overdue");
    expect(formatDaysOverdue(9)).toBe("9 days overdue");
  });

  test("pluralizes counts", () => {
    expect(pluralize(1, "invoice")).toBe("1 invoice");
    expect(pluralize(0, "invoice")).toBe("0 invoices");
  });
});
