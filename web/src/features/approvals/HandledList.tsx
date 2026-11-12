import { StatusText } from "../../components/StatusText";
import { formatRelativeTime } from "../../lib/format";
import type { Action } from "../../lib/types";
import { actionDisplay } from "./actionLogic";
import { ActionSummary } from "./ActionSummary";

function HandledItem({ action, onOpenInvoice }: { action: Action; onOpenInvoice?: (id: string) => void }) {
  const display = actionDisplay(action);
  const when = action.executed_at ?? action.created_at;
  return (
    <li className="flex flex-col gap-1.5 border-b border-line py-3 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <ActionSummary action={action} onOpenInvoice={onOpenInvoice} />
        <p className="text-sm text-muted">
          <StatusText tone={display.tone}>{display.label}</StatusText>
          <span aria-hidden="true"> · </span>
          <time dateTime={when}>{formatRelativeTime(when)}</time>
        </p>
      </div>
      {action.reasoning ? <p className="text-sm leading-relaxed text-muted">{action.reasoning}</p> : null}
      {action.kind === "remind" && action.subject ? (
        <details className="text-sm">
          <summary className="rounded text-sm text-accent">Show the message</summary>
          <p className="mt-2 font-medium text-ink">{action.subject}</p>
          <p className="mt-1 leading-relaxed whitespace-pre-wrap text-muted">{action.message}</p>
        </details>
      ) : null}
      {action.error ? (
        <p role="alert" className="text-sm text-danger">
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
    <ul className="border-t border-line">
      {actions.map((action) => (
        <HandledItem key={action.id} action={action} onOpenInvoice={onOpenInvoice} />
      ))}
    </ul>
  );
}
