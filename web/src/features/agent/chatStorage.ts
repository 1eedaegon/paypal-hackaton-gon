import type { Effect } from "../../lib/types";

export interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  effects: Effect[];
}

const KEY_PREFIX = "duely.chat.";
const MAX_STORED_ENTRIES = 60;

function isChatEntry(value: unknown): value is ChatEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  const roleOk = entry.role === "user" || entry.role === "assistant";
  return typeof entry.id === "string" && roleOk && typeof entry.content === "string" && Array.isArray(entry.effects);
}

/** Reads this user's chat from sessionStorage. Anything unreadable is treated as an empty chat. */
export function loadChatHistory(userId: string): ChatEntry[] {
  try {
    const raw = window.sessionStorage.getItem(KEY_PREFIX + userId);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isChatEntry) : [];
  } catch {
    return [];
  }
}

export function saveChatHistory(userId: string, entries: readonly ChatEntry[]): void {
  try {
    const recent = entries.slice(-MAX_STORED_ENTRIES);
    window.sessionStorage.setItem(KEY_PREFIX + userId, JSON.stringify(recent));
  } catch {
    // Storage can be full or disabled (private mode). The chat still works from memory.
  }
}

export function clearChatHistory(): void {
  try {
    const keys = Object.keys(window.sessionStorage).filter((key) => key.startsWith(KEY_PREFIX));
    keys.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
