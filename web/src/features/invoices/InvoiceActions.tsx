import { useState } from "react";
import { Button } from "../../components/Button";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import { api } from "../../lib/api";
import { formatMoney } from "../../lib/format";
import type { Invoice } from "../../lib/types";
import { useAsyncAction } from "../../lib/useAsyncAction";

interface InvoiceActionsProps {
  invoice: Invoice;
  /** Called after either action so the drawer and the board re-read the invoice. */
  onChanged: () => Promise<void>;
}

export function InvoiceActions({ invoice, onChanged }: InvoiceActionsProps) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const recording = useAsyncAction();
  const syncing = useAsyncAction();
  const busy = recording.pending || syncing.pending;

  const recordPayment = async () => {
    const ok = await recording.run(async () => {
      await api.recordPayment(invoice.id);
    });
    setConfirming(false);
    if (ok) {
      toast.success(`Recorded ${formatMoney(invoice.total)} as paid by ${invoice.recipient_name}.`);
    }
    await onChanged();
  };

  const sync = async () => {
    const ok = await syncing.run(async () => {
      await api.syncInvoice(invoice.id);
    });
    if (ok) {
      toast.success("Up to date with PayPal.");
    }
    await onChanged();
  };

  return (
    <div className="flex flex-wrap gap-2">
      {invoice.status === "sent" ? (
        <Button
          size="sm"
          onClick={() => setConfirming(true)}
          disabled={busy}
        >
          Record payment
        </Button>
      ) : null}
      <Button
        size="sm"
        onClick={sync}
        pending={syncing.pending}
        pendingLabel="Checking PayPal…"
        disabled={busy}
      >
        Refresh from PayPal
      </Button>
      <ConfirmDialog
        open={confirming}
        title="Record this invoice as paid?"
        confirmLabel={`Record ${formatMoney(invoice.total)} as paid`}
        pendingLabel="Recording…"
        pending={recording.pending}
        onConfirm={recordPayment}
        onCancel={() => setConfirming(false)}
      >
        Use this when {invoice.recipient_name} paid you outside PayPal, for example by bank transfer. The full amount
        of {formatMoney(invoice.total)} is recorded as paid and the agent stops following up.
        This can't be undone from Duely.
      </ConfirmDialog>
    </div>
  );
}
