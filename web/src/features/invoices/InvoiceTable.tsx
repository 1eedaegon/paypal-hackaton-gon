import { ChevronRight } from "lucide-react";
import { formatDate, formatMoney, pluralize } from "../../lib/format";
import type { Invoice } from "../../lib/types";
import { invoiceLabel, invoiceStatus } from "./invoiceLogic";
import { StatusPill } from "./StatusPill";

const COLUMNS =
  "sm:grid sm:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_4.5rem_7rem_4.5rem_6.5rem_1rem] sm:items-center sm:gap-3";

function reminderText(count: number): string {
  return count === 0 ? "No reminders" : pluralize(count, "reminder");
}

/** One sentence for screen readers; the visual row is a grid of fragments that reads poorly on its own. */
export function invoiceRowLabel(invoice: Invoice): string {
  return [
    invoice.recipient_name,
    invoiceLabel(invoice),
    formatMoney(invoice.total),
    `due ${formatDate(invoice.due_date)}`,
    invoiceStatus(invoice).label,
    reminderText(invoice.reminder_count),
  ].join(", ");
}

function InvoiceRow({ invoice, onOpen }: { invoice: Invoice; onOpen: (id: string) => void }) {
  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        aria-label={invoiceRowLabel(invoice)}
        onClick={() => onOpen(invoice.id)}
        className={`w-full px-4 py-3 text-left transition-colors hover:bg-paper ${COLUMNS}`}
      >
        <span className="flex items-baseline justify-between gap-3 sm:block sm:min-w-0">
          <span className="block truncate text-sm font-medium text-ink">{invoice.recipient_name}</span>
          <span className="money text-sm font-medium sm:hidden">{formatMoney(invoice.total)}</span>
          <span className="hidden truncate text-xs text-muted sm:block">{invoice.recipient_email}</span>
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted sm:contents sm:text-sm">
          <span className="money truncate sm:text-ink-soft">{invoice.number ?? "No number"}</span>
          <span className="sm:text-ink-soft">
            <span className="sm:hidden">Due </span>
            {formatDate(invoice.due_date)}
          </span>
          <span>
            <StatusPill invoice={invoice} />
          </span>
          <span className="money text-xs">
            {invoice.reminder_count === 0 ? (
              <>
                <span aria-hidden="true" className="hidden sm:inline">
                  –
                </span>
                <span className="sr-only">{reminderText(0)}</span>
              </>
            ) : (
              <>
                <span className="sm:hidden">{reminderText(invoice.reminder_count)}</span>
                <span className="hidden sm:inline">{invoice.reminder_count} sent</span>
              </>
            )}
          </span>
        </span>
        <span className="money hidden text-right text-sm font-medium text-ink sm:block">
          {formatMoney(invoice.total)}
        </span>
        <ChevronRight className="hidden size-4 text-muted sm:block" aria-hidden="true" />
      </button>
    </li>
  );
}

export function InvoiceTable({ invoices, onOpen }: { invoices: readonly Invoice[]; onOpen: (id: string) => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div
        aria-hidden="true"
        className={`hidden border-b border-line bg-paper px-4 py-2 text-xs font-medium tracking-wide text-muted uppercase ${COLUMNS}`}
      >
        <span>Client</span>
        <span>Invoice</span>
        <span>Due</span>
        <span>Status</span>
        <span>Reminders</span>
        <span className="text-right">Amount</span>
        <span />
      </div>
      <ul>
        {invoices.map((invoice) => (
          <InvoiceRow key={invoice.id} invoice={invoice} onOpen={onOpen} />
        ))}
      </ul>
    </div>
  );
}
