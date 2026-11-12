import type { Action, Invoice } from "../lib/types";

export function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv_1",
    number: "0001",
    status: "sent",
    recipient_name: "Acme Studio",
    recipient_email: "maya@acme.example",
    currency: "USD",
    items: [{ name: "Design", quantity: 1, unit_price: "500.00" }],
    total: "500.00",
    due_date: "2026-11-20",
    note: "",
    pay_url: "https://example.test/pay/1",
    is_overdue: false,
    days_overdue: 0,
    reminder_count: 0,
    last_reminded_at: null,
    created_at: "2026-11-01T10:00:00Z",
    sent_at: "2026-11-01T10:05:00Z",
    paid_at: null,
    ...overrides,
  };
}

export function makeAction(overrides: Partial<Action> = {}): Action {
  return {
    id: "act_1",
    invoice_id: "inv_1",
    invoice: { number: "0001", recipient_name: "Acme Studio", total: "500.00", days_overdue: 4 },
    kind: "remind",
    subject: "Friendly reminder",
    message: "Hi Maya, invoice 0001 is still open.",
    reasoning: "Four days past due and no reminder yet.",
    status: "pending",
    error: null,
    created_at: "2026-11-10T09:00:00Z",
    executed_at: null,
    ...overrides,
  };
}
