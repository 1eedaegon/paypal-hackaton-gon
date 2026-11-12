import { createContext, useContext } from "react";
import type { Dashboard } from "../../lib/types";

export type WorkspaceTab = "receivables" | "approvals" | "activity" | "policy" | "agent";

export interface Workspace {
  dashboard: Dashboard;
  /** Re-reads the dashboard now. Call after every mutation. */
  refresh: () => Promise<void>;
  tab: WorkspaceTab;
  setTab: (tab: WorkspaceTab) => void;
  openInvoice: (invoiceId: string) => void;
}

export const WorkspaceContext = createContext<Workspace | null>(null);

export function useWorkspace(): Workspace {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used inside the workspace page");
  }
  return context;
}
