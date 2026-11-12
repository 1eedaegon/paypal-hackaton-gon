import { describe, expect, test } from "vitest";
import { makeAction } from "../../test/fixtures";
import { actionDisplay, handledActions, needsApproval, validateReminder } from "./actionLogic";

describe("actions", () => {
  test("only a pending reminder needs approval", () => {
    expect(needsApproval(makeAction())).toBe(true);
    expect(needsApproval(makeAction({ status: "executed" }))).toBe(false);
    expect(needsApproval(makeAction({ kind: "wait", status: "pending" }))).toBe(false);
  });

  test("labels a wait decision regardless of its status", () => {
    expect(actionDisplay(makeAction({ kind: "wait", status: "executed" })).label).toBe("Decided to wait");
  });

  test("labels sent, rejected and failed reminders", () => {
    expect(actionDisplay(makeAction({ status: "executed" })).label).toBe("Reminder sent");
    expect(actionDisplay(makeAction({ status: "rejected" })).label).toBe("Rejected");
    expect(actionDisplay(makeAction({ status: "failed" })).label).toBe("Failed to send");
  });

  test("lists handled actions newest first and leaves out pending reminders", () => {
    const older = makeAction({ id: "older", status: "rejected", created_at: "2026-11-01T00:00:00Z" });
    const newer = makeAction({ id: "newer", status: "executed", executed_at: "2026-11-09T00:00:00Z" });
    const handled = handledActions([older, makeAction({ id: "pending" }), newer]);
    expect(handled.map((action) => action.id)).toEqual(["newer", "older"]);
  });

  test("requires a subject and a message before a reminder can be sent", () => {
    expect(validateReminder("", "Hello")).toBeDefined();
    expect(validateReminder("Reminder", "  ")).toBeDefined();
    expect(validateReminder("Reminder", "Hello")).toBeUndefined();
  });
});
