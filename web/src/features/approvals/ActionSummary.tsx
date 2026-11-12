import { formatDaysOverdue, formatMoney } from "../../lib/format";
import type { Action } from "../../lib/types";
import { invoiceLabel } from "../invoices/invoiceLogic";

/** Client, invoice, amount and lateness for one proposed follow-up. */
export function ActionSummary({ action, onOpenInvoice }: { action: Action; onOpenInvoice?: (id: string) => void }) {
  const { invoice } = action;
  const lateness = invoice.days_overdue > 0 ? formatDaysOverdue(invoice.days_overdue) : "Not overdue";
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-ink">{invoice.recipient_name}</p>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
        {onOpenInvoice ? (
          <button
            type="button"
            onClick={() => onOpenInvoice(action.invoice_id)}
            className="money rounded underline underline-offset-2 hover:text-ink"
          >
            {invoiceLabel(invoice)}
          </button>
        ) : (
          <span className="money">{invoiceLabel(invoice)}</span>
        )}
        <span aria-hidden="true">·</span>
        <span className="money">{formatMoney(invoice.total)}</span>
        <span aria-hidden="true">·</span>
        <span className={invoice.days_overdue > 0 ? "text-amber" : undefined}>{lateness}</span>
      </p>
    </div>
  );
}

export function Reasoning({ text }: { text: string }) {
  if (text.trim() === "") {
    return null;
  }
  return (
    <div>
      <p className="text-xs text-muted">Agent's reasoning</p>
      <p className="mt-1 text-sm leading-relaxed text-ink">{text}</p>
    </div>
  );
}
