import { ScrollText } from "lucide-react";
import { useCallback } from "react";
import { PanelMessage } from "../../components/PanelMessage";
import { api } from "../../lib/api";
import { describeError } from "../../lib/errors";
import { usePolledResource } from "../../lib/usePolledResource";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { ActivityList } from "./ActivityList";

const ACTIVITY_LIMIT = 50;
const ACTIVITY_POLL_MS = 8000;

export function ActivityTab() {
  const { openInvoice } = useWorkspace();
  const load = useCallback(async () => (await api.listActivity(ACTIVITY_LIMIT)).activity, []);
  const { data, error, loading } = usePolledResource(load, ACTIVITY_POLL_MS);

  if (loading && !data) {
    return <PanelMessage tone="loading">Loading activity…</PanelMessage>;
  }
  if (!data) {
    return <PanelMessage tone="error">{describeError(error)}</PanelMessage>;
  }
  if (data.length === 0) {
    return (
      <PanelMessage icon={<ScrollText className="size-5" aria-hidden="true" />} title="Nothing has happened yet">
        Every draft, approval, reminder and payment will be recorded here, with who did it: the agent, you, or
        PayPal.
      </PanelMessage>
    );
  }
  return (
    <section aria-label="Activity log" className="rounded-2xl border border-line bg-surface px-4 py-1">
      <ActivityList activity={data} onOpenInvoice={openInvoice} />
    </section>
  );
}
