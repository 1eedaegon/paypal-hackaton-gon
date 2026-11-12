import { Inbox } from "lucide-react";
import { useCallback } from "react";
import { PanelMessage } from "../../components/PanelMessage";
import { api } from "../../lib/api";
import { describeError } from "../../lib/errors";
import { pluralize } from "../../lib/format";
import { usePolledResource } from "../../lib/usePolledResource";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { ActionCard } from "./ActionCard";
import { handledActions, needsApproval } from "./actionLogic";
import { HandledList } from "./HandledList";

const HISTORY_POLL_MS = 8000;
const HISTORY_LIMIT = 20;

export function ApprovalsTab() {
  const { dashboard, openInvoice } = useWorkspace();
  const loadAll = useCallback(async () => (await api.listActions()).actions, []);
  const history = usePolledResource(loadAll, HISTORY_POLL_MS);

  const pending = dashboard.pending_actions.filter(needsApproval);
  const handled = handledActions(history.data ?? []).slice(0, HISTORY_LIMIT);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="pending-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="pending-heading" className="font-display text-xl font-medium">
            Waiting for your approval
          </h2>
          <p className="text-sm text-ink-soft">
            {pending.length > 0
              ? `${pluralize(pending.length, "reminder")} drafted by the agent. Edit the wording if you like, then approve or reject.`
              : "Reminders the agent wants to send will wait here for you."}
          </p>
        </div>
        {pending.length === 0 ? (
          <PanelMessage icon={<Inbox className="size-5" aria-hidden="true" />} title="You're all caught up">
            Run a collection review from the agent panel and any reminders it proposes will land here.
          </PanelMessage>
        ) : (
          pending.map((action) => <ActionCard key={action.id} action={action} onHandled={history.refresh} />)
        )}
      </section>
      <section aria-labelledby="handled-heading" className="flex flex-col gap-3">
        <h2 id="handled-heading" className="font-display text-xl font-medium">
          Recently handled
        </h2>
        {history.data === null && history.error ? (
          <PanelMessage tone="error">{describeError(history.error)}</PanelMessage>
        ) : handled.length === 0 ? (
          <p className="text-sm text-ink-soft">
            {history.loading ? "Loading…" : "Sent reminders, rejections and decisions to wait will be listed here."}
          </p>
        ) : (
          <HandledList actions={handled} onOpenInvoice={openInvoice} />
        )}
      </section>
    </div>
  );
}
