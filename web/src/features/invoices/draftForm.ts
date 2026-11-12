import { centsToMoney, toCents } from "../../lib/format";
import type { Invoice, InvoiceDraftInput } from "../../lib/types";
import type { DraftForm, DraftItemForm } from "../../lib/validation";

let keyCounter = 0;

function nextKey(): string {
  keyCounter += 1;
  return `item-${keyCounter}`;
}

export function emptyItem(): DraftItemForm {
  return { key: nextKey(), name: "", quantity: "1", unit_price: "" };
}

export function draftFormFromInvoice(invoice: Invoice): DraftForm {
  return {
    recipient_name: invoice.recipient_name,
    recipient_email: invoice.recipient_email,
    due_date: invoice.due_date,
    note: invoice.note,
    items: invoice.items.map((item) => ({
      key: nextKey(),
      name: item.name,
      quantity: String(item.quantity),
      unit_price: item.unit_price,
    })),
  };
}

/** Converts a validated form to the PATCH body. Call `validateDraft` first. */
export function draftFormToInput(form: DraftForm): InvoiceDraftInput {
  return {
    recipient_name: form.recipient_name.trim(),
    recipient_email: form.recipient_email.trim(),
    due_date: form.due_date,
    note: form.note.trim(),
    items: form.items.map((item) => ({
      name: item.name.trim(),
      quantity: Number(item.quantity),
      unit_price: centsToMoney(toCents(item.unit_price) ?? 0),
    })),
  };
}

export function lineTotalCents(item: Pick<DraftItemForm, "quantity" | "unit_price">): number {
  const quantity = Number(item.quantity);
  const unitCents = toCents(item.unit_price);
  if (!Number.isFinite(quantity) || quantity <= 0 || unitCents === null) {
    return 0;
  }
  return Math.round(quantity * unitCents);
}

export function draftTotalCents(form: Pick<DraftForm, "items">): number {
  return form.items.reduce((sum, item) => sum + lineTotalCents(item), 0);
}

/** True when the two forms would produce different PATCH bodies. */
export function isDraftChanged(a: DraftForm, b: DraftForm): boolean {
  return JSON.stringify(draftFormToInput(a)) !== JSON.stringify(draftFormToInput(b));
}
