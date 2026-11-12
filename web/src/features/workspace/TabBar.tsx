import type { KeyboardEvent } from "react";
import { cx } from "../../lib/cx";
import type { WorkspaceTab } from "./WorkspaceContext";

interface TabDefinition {
  id: WorkspaceTab;
  label: string;
  /** The agent is a side panel on desktop, so its tab only exists on small screens. */
  mobileOnly?: boolean;
}

const TABS: readonly TabDefinition[] = [
  { id: "receivables", label: "Receivables" },
  { id: "approvals", label: "Approvals" },
  { id: "activity", label: "Activity" },
  { id: "policy", label: "Policy" },
  { id: "agent", label: "Agent", mobileOnly: true },
];

export const tabId = (tab: WorkspaceTab) => `workspace-tab-${tab}`;
export const TAB_PANEL_ID = "workspace-tabpanel";

interface TabBarProps {
  active: WorkspaceTab;
  onSelect: (tab: WorkspaceTab) => void;
  pendingApprovals: number;
}

export function TabBar({ active, onSelect, pendingApprovals }: TabBarProps) {
  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
      return;
    }
    const index = TABS.findIndex((tab) => tab.id === active);
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = TABS[(index + step + TABS.length) % TABS.length];
    if (next) {
      onSelect(next.id);
      document.getElementById(tabId(next.id))?.focus();
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Workspace sections"
      onKeyDown={moveFocus}
      className="-mx-4 flex overflow-x-auto border-b border-line px-3 sm:mx-0 sm:gap-1 sm:px-0"
    >
      {TABS.map((tab) => {
        const selected = tab.id === active;
        const showCount = tab.id === "approvals" && pendingApprovals > 0;
        return (
          <button
            key={tab.id}
            id={tabId(tab.id)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={TAB_PANEL_ID}
            aria-label={showCount ? `${tab.label}, ${pendingApprovals} waiting for approval` : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            className={cx(
              "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-2 py-2.5 text-[0.8125rem] font-medium transition-colors sm:gap-2 sm:px-3 sm:text-sm",
              tab.mobileOnly && "lg:hidden",
              selected ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {tab.label}
            {showCount ? (
              <span className="money rounded-full bg-amber-soft px-1.5 py-0.5 text-xs font-semibold text-amber">
                {pendingApprovals}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
