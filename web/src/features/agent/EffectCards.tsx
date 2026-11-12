import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "../../components/Button";
import { useToast } from "../../components/Toast";
import { api } from "../../lib/api";
import { formatDate, formatMoney } from "../../lib/format";
import type { Effect, Invoice } from "../../lib/types";
import { useAsyncAction } from "../../lib/useAsyncAction";
import { invoiceLabel, invoiceStatus } from "../invoices/invoiceLogic";
import { useWorkspace } from "../workspace/WorkspaceContext";
import type { WorkspaceTab } from "../workspace/WorkspaceContext";

const LINK_CLASS = "rounded text-accent underline underline-offset-2 hover:text-accent-strong";

interface EffectLineProps {
  children: ReactNode;
  linkLabel: string;
  onOpen: () => void;
}

/** One plain line: what happened, then where to look. */
function EffectLine({ children, linkLabel, onOpen }: EffectLineProps) {
  return (
    <p className="text-sm text-muted">
      {children} <span aria-hidden="true">—</span>{" "}
      <button type="button" onClick={onOpen} className={LINK_CLASS}>
        {linkLabel}
      </button>
    </p>
  );
}

type Lookup = Invoice | "loading" | "missing";

/** Uses the invoice from the board when it is there, otherwise asks the server once. */
function useEffectInvoice(invoiceId: string): Lookup {
  const { dashboard } = useWorkspace();
  const onBoard = dashboard.invoices.find((invoice) => invoice.id === invoiceId);
  const [fetched, setFetched] = useState<Lookup>("loading");
  const needsFetch = onBoard === undefined;

  useEffect(() => {
    if (!needsFetch) {
      return;
    }
    let cancelled = false;
    api.getInvoice(invoiceId).then(
      ({ invoice }) => !cancelled && setFetched(invoice),
      () => !cancelled && setFetched("missing"),
    );
    return () => {
      cancelled = true;
    };
  }, [invoiceId, needsFetch]);

  return onBoard ?? fetched;
}

/** Compact draft summary. The full editor lives only in Receivables. */
function DraftSummary({ invoice }: { invoice: Invoice }) {
  const { refresh, setTab } = useWorkspace();
  const toast = useToast();
  const sending = useAsyncAction();

  const send = async () => {
    const ok = await sending.run(async () => {
      await api.sendInvoice(invoice.id);
    });
    if (ok) {
      toast.success(`Invoice sent to ${invoice.recipient_name} through PayPal.`);
    }
    await refresh();
  };

  return (
    <div className="border-y border-line py-3">
      <p className="text-xs text-muted">Draft invoice, not sent yet</p>
      <p className="mt-1 text-sm font-medium text-ink">{invoice.recipient_name}</p>
      <p className="money text-sm text-muted">
        {formatMoney(invoice.total)} · due {formatDate(invoice.due_date)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={send} pending={sending.pending} pendingLabel="Sending…">
          Approve &amp; send
        </Button>
        <Button size="sm" onClick={() => setTab("receivables")} disabled={sending.pending}>
          Edit in Receivables
        </Button>
      </div>
    </div>
  );
}

function DraftEffect({ invoiceId }: { invoiceId: string }) {
  const { openInvoice } = useWorkspace();
  const invoice = useEffectInvoice(invoiceId);
  if (invoice === "loading") {
    return <p className="text-sm text-muted">Loading the draft…</p>;
  }
  if (invoice === "missing") {
    return <p className="text-sm text-muted">This draft was discarded.</p>;
  }
  if (invoice.status === "draft") {
    return <DraftSummary invoice={invoice} />;
  }
  return (
    <EffectLine linkLabel="View invoice" onOpen={() => openInvoice(invoice.id)}>
      {invoiceLabel(invoice)} to {invoice.recipient_name}, {formatMoney(invoice.total)}:{" "}
      {invoiceStatus(invoice).label.toLowerCase()}
    </EffectLine>
  );
}

function ProposedEffect({ actionId }: { actionId: string }) {
  const { dashboard, setTab } = useWorkspace();
  const action = dashboard.pending_actions.find((candidate) => candidate.id === actionId);
  const openApprovals = () => setTab("approvals");
  if (!action) {
    // No longer pending: already approved or rejected, or it was a decision to wait.
    return (
      <EffectLine linkLabel="See Approvals" onOpen={openApprovals}>
        Follow-up recorded
      </EffectLine>
    );
  }
  return (
    <EffectLine linkLabel="Review in Approvals" onOpen={openApprovals}>
      Reminder drafted for {action.invoice.recipient_name}
    </EffectLine>
  );
}

function effectKey(effect: Effect, index: number): string {
  if (effect.type === "invoice_drafted") {
    return `draft-${effect.invoice_id}`;
  }
  return effect.type === "policy_updated" ? `policy-${index}` : `${effect.type}-${effect.action_id}`;
}

function EffectCard({ effect }: { effect: Effect }) {
  const { setTab } = useWorkspace();
  const open = (tab: WorkspaceTab) => () => setTab(tab);
  switch (effect.type) {
    case "invoice_drafted":
      return <DraftEffect invoiceId={effect.invoice_id} />;
    case "action_proposed":
      return <ProposedEffect actionId={effect.action_id} />;
    case "action_executed":
      return (
        <EffectLine linkLabel="See Approvals" onOpen={open("approvals")}>
          Reminder sent
        </EffectLine>
      );
    case "policy_updated":
      return (
        <EffectLine linkLabel="Open Policy" onOpen={open("policy")}>
          Policy updated
        </EffectLine>
      );
  }
}

/** What the agent actually did in one turn, as plain lines under its reply. */
export function EffectCards({ effects }: { effects: readonly Effect[] }) {
  if (effects.length === 0) {
    return null;
  }
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {effects.map((effect, index) => (
        <EffectCard key={effectKey(effect, index)} effect={effect} />
      ))}
    </div>
  );
}
