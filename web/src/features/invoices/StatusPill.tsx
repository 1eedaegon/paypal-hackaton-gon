import { Ban, CircleCheck, Clock, PencilLine, Send } from "lucide-react";
import { Pill } from "../../components/Pill";
import type { Invoice } from "../../lib/types";
import { invoiceStatus } from "./invoiceLogic";
import type { StatusDisplay } from "./invoiceLogic";

const ICONS: Record<StatusDisplay["kind"], typeof Send> = {
  draft: PencilLine,
  sent: Send,
  overdue: Clock,
  paid: CircleCheck,
  cancelled: Ban,
};

export function StatusPill({ invoice }: { invoice: Pick<Invoice, "status" | "is_overdue" | "days_overdue"> }) {
  const status = invoiceStatus(invoice);
  const Icon = ICONS[status.kind];
  return (
    <Pill tone={status.tone} icon={<Icon className="size-3" aria-hidden="true" />}>
      {status.label}
    </Pill>
  );
}
