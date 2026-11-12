import { formatCents, formatDate, formatDateTime, formatDaysOverdue, formatMoney, toCents } from "../../lib/format";
import type { Invoice, InvoiceItem } from "../../lib/types";

function itemTotal(item: InvoiceItem): string {
  const unitCents = toCents(item.unit_price);
  return unitCents === null ? "" : formatCents(Math.round(item.quantity * unitCents));
}

export function ItemsTable({ invoice }: { invoice: Invoice }) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Line items</caption>
      <thead>
        <tr className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
          <th scope="col" className="py-2 font-medium">
            Item
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            Qty
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            Price
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            Amount
          </th>
        </tr>
      </thead>
      <tbody>
        {invoice.items.map((item, index) => (
          <tr key={`${item.name}-${index}`} className="border-b border-line align-top">
            <td className="py-2 pr-2 text-ink">{item.name}</td>
            <td className="money py-2 text-right text-ink-soft">{item.quantity}</td>
            <td className="money py-2 pl-2 text-right text-ink-soft">{formatMoney(item.unit_price)}</td>
            <td className="money py-2 pl-2 text-right text-ink">{itemTotal(item)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" colSpan={3} className="pt-3 text-right text-sm font-medium text-muted">
            Total (USD)
          </th>
          <td className="money pt-3 pl-2 text-right font-display text-xl font-medium">
            {formatMoney(invoice.total)}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

function reminderFact(invoice: Invoice): string {
  if (invoice.reminder_count === 0) {
    return "None sent";
  }
  const last = invoice.last_reminded_at ? `, last ${formatDateTime(invoice.last_reminded_at)}` : "";
  return `${invoice.reminder_count} sent${last}`;
}

export function InvoiceFacts({ invoice }: { invoice: Invoice }) {
  const due = invoice.is_overdue
    ? `${formatDate(invoice.due_date)} (${formatDaysOverdue(invoice.days_overdue)})`
    : formatDate(invoice.due_date);
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      <Fact label="Due" value={due} />
      <Fact label="Sent" value={invoice.sent_at ? formatDateTime(invoice.sent_at) : "Not sent"} />
      <Fact label="Reminders" value={reminderFact(invoice)} />
      <Fact label="Paid" value={invoice.paid_at ? formatDateTime(invoice.paid_at) : "Not yet"} />
    </dl>
  );
}
