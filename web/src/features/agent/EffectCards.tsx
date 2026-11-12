import { ArrowRight, CircleCheck, ScrollText } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../../lib/api";
import { formatMoney } from "../../lib/format";
import type { Effect, Invoice } from "../../lib/types";
import { needsApproval } from "../approvals/actionLogic";
import { DraftCard } from "../invoices/DraftCard";
import { invoiceLabel } from "../invoices/invoiceLogic";
import { StatusPill } from "../invoices/StatusPill";
import { useWorkspace } from "../workspace/WorkspaceContext";
import type { WorkspaceTab } from "../workspace/WorkspaceContext";

interface ChipProps {
  icon: ReactNode;
  label: string;
  linkLabel: string;
  onOpen: () => void;
}

function EffectChip({ icon, label, linkLabel, onOpen }: ChipProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
      <span className="inline-flex items-center gap-2 font-medium text-ink">
        {icon}
        {label}
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center gap-1 rounded text-xs font-medium text-accent hover:text-accent-strong"
      >
        {linkLabel}
        <ArrowRight className="size-3" aria-hidden="true" />
      </button>
    </div>
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

function DraftEffect({ invoiceId }: { invoiceId: string }) {
  const { openInvoice } = useWorkspace();
  const invoice = useEffectInvoice(invoiceId);
  if (invoice === "loading") {
    return <p className="text-xs text-muted">Loading the draft…</p>;
  }
  if (invoice === "missing") {
    return <p className="text-xs text-muted">This draft was discarded.</p>;
  }
  if (invoice.status === "draft") {
    return <DraftCard invoice={invoice} />;
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">{invoice.recipient_name}</span>
        <span className="money text-xs text-muted">
          {invoiceLabel(invoice)} · {formatMoney(invoice.total)}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <StatusPill invoice={invoice} />
        <button
          type="button"
          onClick={() => openInvoice(invoice.id)}
          className="rounded text-xs font-medium text-accent hover:text-accent-strong"
        >
          View
        </button>
      </span>
    </div>
  );
}

function ProposedEffect({ actionId }: { actionId: string }) {
  const { dashboard, setTab } = useWorkspace();
  const action = dashboard.pending_actions.find((candidate) => candidate.id === actionId);
  const openApprovals = () => setTab("approvals");
  if (!action) {
    return (
      <EffectChip
        icon={<CircleCheck className="size-4 text-muted" aria-hidden="true" />}
        label="Follow-up handled"
        linkLabel="Approvals"
        onOpen={openApprovals}
      />
    );
  }
  if (!needsApproval(action)) {
    return (
      <EffectChip
        icon={<CircleCheck className="size-4 text-muted" aria-hidden="true" />}
        label={`Waiting on ${action.invoice.recipient_name} for now`}
        linkLabel="See why"
        onOpen={openApprovals}
      />
    );
  }
  return (
    <div className="rounded-xl border border-amber-line bg-amber-soft/60 px-3 py-2 text-sm">
      <p className="font-medium text-ink">Reminder drafted for {action.invoice.recipient_name}</p>
      <p className="mt-0.5 truncate text-xs text-ink-soft">{action.subject}</p>
      <button
        type="button"
        onClick={openApprovals}
        className="mt-2 inline-flex items-center gap-1 rounded text-xs font-medium text-accent-strong underline underline-offset-2"
      >
        Review in Approvals
        <ArrowRight className="size-3" aria-hidden="true" />
      </button>
    </div>
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
        <EffectChip
          icon={<CircleCheck className="size-4 text-accent" aria-hidden="true" />}
          label="Reminder sent"
          linkLabel="Approvals"
          onOpen={open("approvals")}
        />
      );
    case "policy_updated":
      return (
        <EffectChip
          icon={<ScrollText className="size-4 text-accent" aria-hidden="true" />}
          label="Policy updated"
          linkLabel="Policy"
          onOpen={open("policy")}
        />
      );
  }
}

/** What the agent actually did in one turn, rendered under its reply. */
export function EffectCards({ effects }: { effects: readonly Effect[] }) {
  if (effects.length === 0) {
    return null;
  }
  return (
    <div className="mt-2 flex flex-col gap-2">
      {effects.map((effect, index) => (
        <EffectCard key={effectKey(effect, index)} effect={effect} />
      ))}
    </div>
  );
}
