import { Sparkles, WifiOff } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "../../components/Button";
import { FullPageStatus } from "../../components/FullPageStatus";
import { api } from "../../lib/api";
import { cx } from "../../lib/cx";
import { describeError } from "../../lib/errors";
import type { User } from "../../lib/types";
import { usePolledResource } from "../../lib/usePolledResource";
import { ActivityTab } from "../activity/ActivityTab";
import { AgentPanel } from "../agent/AgentPanel";
import { needsApproval } from "../approvals/actionLogic";
import { ApprovalsTab } from "../approvals/ApprovalsTab";
import { useAuth } from "../auth/AuthContext";
import { InvoiceDrawer } from "../invoices/InvoiceDrawer";
import { ReceivablesTab } from "../invoices/ReceivablesTab";
import { PolicyTab } from "../policy/PolicyTab";
import { SummaryTiles } from "./SummaryTiles";
import { TAB_PANEL_ID, TabBar, tabId } from "./TabBar";
import { TopBar } from "./TopBar";
import { WorkspaceContext } from "./WorkspaceContext";
import type { Workspace, WorkspaceTab } from "./WorkspaceContext";

const DASHBOARD_POLL_MS = 4000;

function LoadFailure({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <WifiOff className="size-6 text-danger" aria-hidden="true" />
      <h1 className="font-display text-2xl font-medium">Your workspace didn't load</h1>
      <p className="max-w-sm text-sm text-ink-soft">{describeError(error)}</p>
      <Button variant="primary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function TabContent({ tab, policyReloadKey }: { tab: WorkspaceTab; policyReloadKey: number }) {
  switch (tab) {
    case "approvals":
      return <ApprovalsTab />;
    case "activity":
      return <ActivityTab />;
    case "policy":
      return <PolicyTab reloadKey={policyReloadKey} />;
    default:
      // "agent" only exists as a tab on small screens; on desktop the board stays visible beside the panel.
      return <ReceivablesTab />;
  }
}

function WorkspaceShell({ user }: { user: User }) {
  const load = useCallback(() => api.dashboard(), []);
  const { data, error, refresh } = usePolledResource(load, DASHBOARD_POLL_MS);
  const [tab, setTab] = useState<WorkspaceTab>("receivables");
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const [policyReloadKey, setPolicyReloadKey] = useState(0);

  const bumpPolicy = useCallback(() => setPolicyReloadKey((key) => key + 1), []);
  const closeInvoice = useCallback(() => setOpenInvoiceId(null), []);

  const workspace = useMemo<Workspace | null>(
    () => (data ? { dashboard: data, refresh, tab, setTab, openInvoice: setOpenInvoiceId } : null),
    [data, refresh, tab],
  );

  if (!workspace) {
    return error ? <LoadFailure error={error} onRetry={refresh} /> : <FullPageStatus label="Loading your receivables" />;
  }

  const { dashboard } = workspace;
  const pendingApprovals = dashboard.pending_actions.filter(needsApproval).length;
  const agentTabActive = tab === "agent";

  return (
    <WorkspaceContext.Provider value={workspace}>
      <TopBar user={user} usage={dashboard.usage} />
      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 pt-5 pb-20 sm:px-6 lg:pb-8">
        <h1 className="sr-only">Duely workspace</h1>
        {error ? (
          <p role="status" className="rounded-xl border border-amber-line bg-amber-soft px-3 py-2 text-sm text-amber">
            Live updates are paused: {describeError(error)} Showing the last data we received.
          </p>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-start">
          <div className="flex min-w-0 flex-col gap-5">
            <div className={cx(agentTabActive && "hidden lg:block")}>
              <SummaryTiles summary={dashboard.summary} />
            </div>
            <TabBar active={tab} onSelect={setTab} pendingApprovals={pendingApprovals} />
            <div
              id={TAB_PANEL_ID}
              role="tabpanel"
              aria-labelledby={tabId(tab)}
              className={cx(agentTabActive && "hidden lg:block")}
            >
              <TabContent tab={tab} policyReloadKey={policyReloadKey} />
            </div>
          </div>
          <AgentPanel
            userId={user.id}
            onPolicyUpdated={bumpPolicy}
            className={cx(
              agentTabActive ? "flex" : "hidden",
              "h-[calc(100dvh-8rem)] min-h-96 lg:sticky lg:top-[4.75rem] lg:flex lg:h-[calc(100dvh-6rem)]",
            )}
          />
        </div>
      </main>
      {agentTabActive ? null : (
        <Button
          variant="primary"
          className="fixed right-4 bottom-4 z-10 rounded-full shadow-lg shadow-ink/20 lg:hidden"
          icon={<Sparkles className="size-4" aria-hidden="true" />}
          onClick={() => setTab("agent")}
        >
          Ask the agent
        </Button>
      )}
      <InvoiceDrawer invoiceId={openInvoiceId} onClose={closeInvoice} />
    </WorkspaceContext.Provider>
  );
}

export function WorkspacePage() {
  const { user } = useAuth();
  return user ? <WorkspaceShell user={user} /> : null;
}
