import { describe, expect, test } from "vitest";
import { MAX_CHAT_MESSAGE_LENGTH } from "../../lib/validation";
import { isQuotaUsedUp, MAX_HISTORY_MESSAGES, newEntry, toApiHistory } from "./chatLogic";
import { splitBold } from "./richText";

describe("toApiHistory", () => {
  test("sends only role and content", () => {
    const history = toApiHistory([newEntry("user", "Bill Acme $500"), newEntry("assistant", "Drafted.", [{ type: "policy_updated" }])]);
    expect(history).toEqual([
      { role: "user", content: "Bill Acme $500" },
      { role: "assistant", content: "Drafted." },
    ]);
  });

  test("keeps the most recent 20 messages so the last one is still the user turn", () => {
    const entries = Array.from({ length: 31 }, (_, index) => newEntry(index % 2 === 0 ? "user" : "assistant", `m${index}`));
    const history = toApiHistory(entries);
    expect(history).toHaveLength(MAX_HISTORY_MESSAGES);
    expect(history.at(-1)).toEqual({ role: "user", content: "m30" });
  });

  test("truncates a message that is over the contract limit", () => {
    const history = toApiHistory([newEntry("user", "x".repeat(MAX_CHAT_MESSAGE_LENGTH + 50))]);
    expect(history[0]?.content).toHaveLength(MAX_CHAT_MESSAGE_LENGTH);
  });
});

describe("agent quota", () => {
  test("is used up once today's calls reach the daily limit", () => {
    expect(isQuotaUsedUp({ agent_calls_today: 20, agent_daily_limit: 20 })).toBe(true);
    expect(isQuotaUsedUp({ agent_calls_today: 3, agent_daily_limit: 20 })).toBe(false);
  });
});

describe("splitBold", () => {
  test("marks the text between double asterisks as bold", () => {
    expect(splitBold("Send **now** please")).toEqual([
      { text: "Send ", bold: false },
      { text: "now", bold: true },
      { text: " please", bold: false },
    ]);
  });
});
