import { MAX_CHAT_MESSAGE_LENGTH } from "../../lib/validation";
import type { ChatMessage, Usage } from "../../lib/types";
import type { ChatEntry } from "./chatStorage";

export const MAX_HISTORY_MESSAGES = 20;
export const REVIEW_PROMPT = "Run a collection review of my unpaid invoices.";

/** The contract allows at most 20 messages of 6000 characters, and the last must be the user turn. */
export function toApiHistory(entries: readonly ChatEntry[]): ChatMessage[] {
  return entries
    .filter((entry) => entry.content.trim() !== "")
    .slice(-MAX_HISTORY_MESSAGES)
    .map((entry) => ({ role: entry.role, content: entry.content.slice(0, MAX_CHAT_MESSAGE_LENGTH) }));
}

let entryCounter = 0;

export function newEntry(role: ChatEntry["role"], content: string, effects: ChatEntry["effects"] = []): ChatEntry {
  entryCounter += 1;
  return { id: `${Date.now()}-${entryCounter}`, role, content, effects };
}

export function isQuotaUsedUp(usage: Usage): boolean {
  return usage.agent_daily_limit > 0 && usage.agent_calls_today >= usage.agent_daily_limit;
}
