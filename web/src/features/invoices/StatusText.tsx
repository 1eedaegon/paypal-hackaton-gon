import { StatusText } from "../../components/StatusText";
import type { Invoice } from "../../lib/types";
import { invoiceStatus } from "./invoiceLogic";

/** Invoice status in plain words: "Overdue 9 days", "Paid", "Sent", "Draft". */
export function InvoiceStatusText({ invoice }: { invoice: Pick<Invoice, "status" | "is_overdue" | "days_overdue"> }) {
  const status = invoiceStatus(invoice);
  return <StatusText tone={status.tone}>{status.label}</StatusText>;
}
