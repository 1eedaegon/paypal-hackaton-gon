import type { StatusTone } from "../../components/StatusText";
import type { Action } from "../../lib/types";

export interface ActionDisplay {
  label: string;
  tone: StatusTone;
}

export function actionDisplay(action: Pick<Action, "kind" | "status">): ActionDisplay {
  if (action.kind === "wait") {
    return { label: "Decided to wait", tone: "muted" };
  }
  switch (action.status) {
    case "pending":
      return { label: "Needs approval", tone: "muted" };
    case "executed":
      return { label: "Reminder sent", tone: "muted" };
    case "rejected":
      return { label: "Rejected", tone: "muted" };
    case "failed":
      return { label: "Failed to send", tone: "red" };
    case "superseded":
      return { label: "Replaced by a newer proposal", tone: "muted" };
  }
}

/** A reminder that is still waiting for the user. Wait decisions never need approval. */
export function needsApproval(action: Pick<Action, "kind" | "status">): boolean {
  return action.kind === "remind" && action.status === "pending";
}

export function handledActions(actions: readonly Action[]): Action[] {
  return actions
    .filter((action) => !needsApproval(action))
    .sort((a, b) => (b.executed_at ?? b.created_at).localeCompare(a.executed_at ?? a.created_at));
}

export function validateReminder(subject: string, message: string): string | undefined {
  if (subject.trim() === "") {
    return "Add a subject line.";
  }
  if (message.trim() === "") {
    return "The reminder needs a message.";
  }
  return undefined;
}
