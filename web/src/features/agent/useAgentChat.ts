import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { describeError, isApiError } from "../../lib/errors";
import type { AgentResult } from "../../lib/types";
import { validateChatMessage } from "../../lib/validation";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { newEntry, REVIEW_PROMPT, toApiHistory } from "./chatLogic";
import { loadChatHistory, saveChatHistory } from "./chatStorage";
import type { ChatEntry } from "./chatStorage";

type Pending = "chat" | "review" | null;

interface AgentChatOptions {
  userId: string;
  onPolicyUpdated: () => void;
}

/** Chat state for the agent panel: history, the two agent calls, and their pending/error state. */
export function useAgentChat({ userId, onPolicyUpdated }: AgentChatOptions) {
  const { refresh } = useWorkspace();
  const [entries, setEntries] = useState<ChatEntry[]>(() => loadChatHistory(userId));
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    saveChatHistory(userId, entries);
  }, [userId, entries]);

  const runAgent = useCallback(
    async (kind: Exclude<Pending, null>, userText: string, call: (history: ChatEntry[]) => Promise<AgentResult>) => {
      const userEntry = newEntry("user", userText);
      const history = [...entries, userEntry];
      setEntries(history);
      setPending(kind);
      setError(null);
      try {
        const result = await call(history);
        // Refresh first so the cards rendered for the effects find their invoice or action.
        await refresh();
        if (result.effects.some((effect) => effect.type === "policy_updated")) {
          onPolicyUpdated();
        }
        setEntries((current) => [...current, newEntry("assistant", result.reply, result.effects)]);
        return true;
      } catch (caught) {
        setEntries((current) => current.filter((entry) => entry.id !== userEntry.id));
        if (!isApiError(caught, "unauthorized")) {
          setError(describeError(caught));
        }
        await refresh();
        return false;
      } finally {
        setPending(null);
      }
    },
    [entries, refresh, onPolicyUpdated],
  );

  /** Resolves to true when the message was accepted, so the composer can clear itself. */
  const send = useCallback(
    async (text: string): Promise<boolean> => {
      const problem = validateChatMessage(text);
      if (problem) {
        setError(problem);
        return false;
      }
      return runAgent("chat", text.trim(), (history) => api.agentChat(toApiHistory(history)));
    },
    [runAgent],
  );

  const runReview = useCallback(() => runAgent("review", REVIEW_PROMPT, () => api.agentReview()), [runAgent]);

  const clear = useCallback(() => {
    setEntries([]);
    setError(null);
  }, []);

  return { entries, pending, error, send, runReview, clear };
}
