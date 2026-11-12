import { formatDateTime, formatRelativeTime } from "../../lib/format";
import type { Activity, Actor } from "../../lib/types";

const ACTOR_LABEL: Record<Actor, string> = { agent: "Agent", user: "You", paypal: "PayPal", system: "System" };

interface ActivityListProps {
  activity: readonly Activity[];
  onOpenInvoice?: (invoiceId: string) => void;
}

function newestFirst(activity: readonly Activity[]): Activity[] {
  return [...activity].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function ActivityList({ activity, onOpenInvoice }: ActivityListProps) {
  return (
    <ol className="flex flex-col">
      {newestFirst(activity).map((entry) => (
        <li key={entry.id} className="flex gap-3 border-b border-line py-3 text-sm last:border-b-0">
          <span className="w-14 shrink-0 text-muted">{ACTOR_LABEL[entry.actor] ?? ACTOR_LABEL.system}</span>
          <div className="min-w-0 flex-1">
            <p className="leading-snug text-ink">{entry.summary}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
              <time dateTime={entry.created_at} title={formatDateTime(entry.created_at)}>
                {formatRelativeTime(entry.created_at)}
              </time>
              {entry.invoice_id && onOpenInvoice ? (
                <button
                  type="button"
                  onClick={() => onOpenInvoice(entry.invoice_id as string)}
                  className="rounded text-accent underline underline-offset-2 hover:text-accent-strong"
                >
                  View invoice
                </button>
              ) : null}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
