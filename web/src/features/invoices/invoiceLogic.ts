import type { StatusTone } from "../../components/StatusText";
import { pluralize } from "../../lib/format";
import type { Invoice } from "../../lib/types";

export interface StatusDisplay {
  label: string;
  tone: StatusTone;
  kind: "draft" | "sent" | "overdue" | "paid" | "cancelled";
}

export function invoiceStatus(invoice: Pick<Invoice, "status" | "is_overdue" | "days_overdue">): StatusDisplay {
  if (invoice.status === "draft") {
    return { label: "Draft", tone: "muted", kind: "draft" };
  }
  if (invoice.status === "paid") {
    return { label: "Paid", tone: "green", kind: "paid" };
  }
  if (invoice.status === "cancelled") {
    return { label: "Cancelled", tone: "muted", kind: "cancelled" };
  }
  if (invoice.is_overdue) {
    return { label: `Overdue ${pluralize(invoice.days_overdue, "day")}`, tone: "amber", kind: "overdue" };
  }
  return { label: "Sent", tone: "muted", kind: "sent" };
}

const GROUP_ORDER: Record<StatusDisplay["kind"], number> = {
  overdue: 0,
  sent: 1,
  draft: 2,
  paid: 3,
  cancelled: 4,
};

function compareWithinGroup(kind: StatusDisplay["kind"], a: Invoice, b: Invoice): number {
  if (kind === "overdue") {
    return b.days_overdue - a.days_overdue;
  }
  if (kind === "paid") {
    return (b.paid_at ?? "").localeCompare(a.paid_at ?? "");
  }
  return a.due_date.localeCompare(b.due_date);
}

/** Overdue first (longest overdue on top), then sent by nearest due date, then paid (most recent first). */
export function sortInvoices(invoices: readonly Invoice[]): Invoice[] {
  return [...invoices].sort((a, b) => {
    const kindA = invoiceStatus(a).kind;
    const kindB = invoiceStatus(b).kind;
    if (kindA !== kindB) {
      return GROUP_ORDER[kindA] - GROUP_ORDER[kindB];
    }
    return compareWithinGroup(kindA, a, b);
  });
}

export function splitDrafts(invoices: readonly Invoice[]): { drafts: Invoice[]; issued: Invoice[] } {
  return {
    drafts: invoices.filter((invoice) => invoice.status === "draft"),
    issued: sortInvoices(invoices.filter((invoice) => invoice.status !== "draft")),
  };
}

export function invoiceLabel(invoice: { number: string | null }): string {
  return invoice.number ? `Invoice ${invoice.number}` : "Draft invoice";
}
