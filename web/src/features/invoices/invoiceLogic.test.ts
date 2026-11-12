import { describe, expect, test } from "vitest";
import { makeInvoice } from "../../test/fixtures";
import { draftFormFromInvoice, draftFormToInput, draftTotalCents, isDraftChanged, lineTotalCents } from "./draftForm";
import { invoiceStatus, sortInvoices, splitDrafts } from "./invoiceLogic";

describe("invoiceStatus", () => {
  test("labels an overdue invoice with the number of days", () => {
    const status = invoiceStatus(makeInvoice({ is_overdue: true, days_overdue: 9 }));
    expect(status.label).toBe("Overdue 9 days");
    expect(status.kind).toBe("overdue");
  });

  test("labels each plain status", () => {
    expect(invoiceStatus(makeInvoice({ status: "draft" })).label).toBe("Draft");
    expect(invoiceStatus(makeInvoice({ status: "sent" })).label).toBe("Sent");
    expect(invoiceStatus(makeInvoice({ status: "paid" })).label).toBe("Paid");
    expect(invoiceStatus(makeInvoice({ status: "cancelled" })).label).toBe("Cancelled");
  });
});

describe("sortInvoices", () => {
  const paid = makeInvoice({ id: "paid", status: "paid", paid_at: "2026-11-05T00:00:00Z" });
  const sentLater = makeInvoice({ id: "sent-later", due_date: "2026-12-01" });
  const sentSooner = makeInvoice({ id: "sent-sooner", due_date: "2026-11-15" });
  const overdueShort = makeInvoice({ id: "overdue-3", is_overdue: true, days_overdue: 3 });
  const overdueLong = makeInvoice({ id: "overdue-12", is_overdue: true, days_overdue: 12 });

  test("puts overdue first (longest first), then sent by nearest due date, then paid", () => {
    const sorted = sortInvoices([paid, sentLater, overdueShort, sentSooner, overdueLong]);
    expect(sorted.map((invoice) => invoice.id)).toEqual(["overdue-12", "overdue-3", "sent-sooner", "sent-later", "paid"]);
  });

  test("does not mutate the array it was given", () => {
    const input = [paid, overdueLong];
    sortInvoices(input);
    expect(input.map((invoice) => invoice.id)).toEqual(["paid", "overdue-12"]);
  });

  test("separates drafts from issued invoices", () => {
    const draft = makeInvoice({ id: "draft", status: "draft", number: null });
    const { drafts, issued } = splitDrafts([paid, draft, overdueLong]);
    expect(drafts.map((invoice) => invoice.id)).toEqual(["draft"]);
    expect(issued.map((invoice) => invoice.id)).toEqual(["overdue-12", "paid"]);
  });
});

describe("draft form", () => {
  const invoice = makeInvoice({
    status: "draft",
    items: [
      { name: "Translation", quantity: 3, unit_price: "180.00" },
      { name: "Rush fee", quantity: 1, unit_price: "49.5" },
    ],
  });

  test("totals line items in cents", () => {
    const form = draftFormFromInvoice(invoice);
    expect(lineTotalCents(form.items[0]!)).toBe(54000);
    expect(draftTotalCents(form)).toBe(58950);
  });

  test("counts an invalid line as zero instead of NaN", () => {
    expect(lineTotalCents({ quantity: "abc", unit_price: "10" })).toBe(0);
    expect(lineTotalCents({ quantity: "2", unit_price: "" })).toBe(0);
  });

  test("produces the PATCH body with numeric quantity and two-decimal prices", () => {
    const input = draftFormToInput(draftFormFromInvoice(invoice));
    expect(input.items).toEqual([
      { name: "Translation", quantity: 3, unit_price: "180.00" },
      { name: "Rush fee", quantity: 1, unit_price: "49.50" },
    ]);
    expect(input.due_date).toBe("2026-11-20");
  });

  test("detects an edit and ignores whitespace-only differences", () => {
    const form = draftFormFromInvoice(invoice);
    expect(isDraftChanged(form, { ...form, recipient_name: `${form.recipient_name}  ` })).toBe(false);
    expect(isDraftChanged(form, { ...form, due_date: "2026-12-01" })).toBe(true);
  });
});
