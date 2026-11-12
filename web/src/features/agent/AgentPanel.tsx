import { useState } from "react";
import { Button } from "../../components/Button";
import { cx } from "../../lib/cx";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { isQuotaUsedUp } from "./chatLogic";
import { Composer } from "./Composer";
import { EmptyChat } from "./EmptyChat";
import { MessageList } from "./MessageList";
import { useAgentChat } from "./useAgentChat";

interface AgentPanelProps {
  userId: string;
  onPolicyUpdated: () => void;
  className?: string;
}

const QUOTA_NOTE =
  "You've used all of today's agent calls. The limit resets tomorrow. You can still edit, approve and send by hand.";

export function AgentPanel({ userId, onPolicyUpdated, className }: AgentPanelProps) {
  const { dashboard } = useWorkspace();
  const chat = useAgentChat({ userId, onPolicyUpdated });
  const [draft, setDraft] = useState("");
  const busy = chat.pending !== null;
  const quotaUsedUp = isQuotaUsedUp(dashboard.usage);
  const unpaidCount = dashboard.summary.counts.sent;

  const submit = async () => {
    if (busy) {
      return;
    }
    const text = draft;
    setDraft("");
    const accepted = await chat.send(text);
    if (!accepted) {
      setDraft((current) => (current === "" ? text : current));
    }
  };

  return (
    <section
      aria-label="Duely agent"
      className={cx("flex min-h-0 flex-col rounded-lg border border-line bg-surface", className)}
    >
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-base font-medium">Agent</h2>
        {chat.entries.length > 0 ? (
          <button
            type="button"
            onClick={chat.clear}
            disabled={busy}
            className="rounded text-xs font-medium text-muted underline underline-offset-2 hover:text-ink disabled:opacity-50"
          >
            Clear chat
          </button>
        ) : null}
      </header>
      <div data-chat-scroll className="min-h-48 flex-1 overflow-y-auto px-4 py-4">
        {chat.entries.length === 0 && !busy ? (
          <EmptyChat onPick={setDraft} />
        ) : (
          <MessageList entries={chat.entries} pending={chat.pending} />
        )}
      </div>
      <div className="flex flex-col gap-2 border-t border-line px-3 py-3">
        {chat.error ? (
          <p role="alert" className="px-1 text-sm text-danger">
            {chat.error}
          </p>
        ) : null}
        {quotaUsedUp && !chat.error ? (
          <p className="px-1 text-sm text-muted">{QUOTA_NOTE}</p>
        ) : null}
        <Button
          size="sm"
          onClick={chat.runReview}
          pending={chat.pending === "review"}
          pendingLabel="Reviewing…"
          disabled={busy || quotaUsedUp}
          title={unpaidCount === 0 ? "There are no unpaid invoices to review yet" : undefined}
        >
          Run collection review
        </Button>
        <Composer
          value={draft}
          onChange={setDraft}
          onSubmit={submit}
          pending={chat.pending === "chat"}
          disabled={busy || quotaUsedUp}
        />
      </div>
    </section>
  );
}
