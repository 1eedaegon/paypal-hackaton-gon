import { Pill } from "../../components/Pill";
import { formatRelativeTime } from "../../lib/format";
import type { Action } from "../../lib/types";
import { actionDisplay } from "./actionLogic";
import { ActionSummary } from "./ActionSummary";

function HandledItem({ action, onOpenInvoice }: { action: Action; onOpenInvoice?: (id: string) => void }) {
  const display = actionDisplay(action);
  const when = action.executed_at ?? action.created_at;
  return (
    <li className="flex flex-col gap-2 border-b border-line py-3 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <ActionSummary action={action} onOpenInvoice={onOpenInvoice} />
        <div className="flex items-center gap-2">
          <time dateTime={when} className="text-xs text-muted">
            {formatRelativeTime(when)}
          </time>
          <Pill tone={display.tone}>{display.label}</Pill>
        </div>
      </div>
      {action.reasoning ? <p className="text-sm leading-relaxed text-ink-soft">{action.reasoning}</p> : null}
      {action.kind === "remind" && action.subject ? (
        <details className="text-sm">
          <summary className="rounded text-xs font-medium text-accent">Show the message</summary>
          <div className="mt-2 rounded-lg bg-paper px-3 py-2">
            <p className="font-medium text-ink">{action.subject}</p>
            <p className="mt-1 leading-relaxed whitespace-pre-wrap text-ink-soft">{action.message}</p>
          </div>
        </details>
      ) : null}
      {action.error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {action.error}
        </p>
      ) : null}
    </li>
  );
}

/** Read-only list of follow-ups that are no longer waiting: sent, rejected, failed, or "wait" decisions. */
export function HandledList({
  actions,
  onOpenInvoice,
}: {
  actions: readonly Action[];
  onOpenInvoice?: (id: string) => void;
}) {
  return (
    <ul className="rounded-2xl border border-line bg-surface px-4 py-1">
      {actions.map((action) => (
        <HandledItem key={action.id} action={action} onOpenInvoice={onOpenInvoice} />
      ))}
    </ul>
  );
}
