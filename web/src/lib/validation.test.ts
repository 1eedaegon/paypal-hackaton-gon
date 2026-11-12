import { describe, expect, test } from "vitest";
import {
  hasErrors,
  isValidEmail,
  MAX_CHAT_MESSAGE_LENGTH,
  validateChatMessage,
  validateDraft,
  validateLogin,
  validateSignup,
} from "./validation";
import type { DraftForm } from "./validation";

const validDraft: DraftForm = {
  recipient_name: "Acme Studio",
  recipient_email: "maya@acme.example",
  due_date: "2026-11-26",
  note: "",
  items: [{ key: "a", name: "Landing page", quantity: "1", unit_price: "1200" }],
};

describe("signup and login validation", () => {
  test("accepts a complete signup", () => {
    const errors = validateSignup({ name: "Dae", email: "dae@example.com", password: "longenough" });
    expect(hasErrors(errors)).toBe(false);
  });

  test("rejects a password shorter than 8 characters", () => {
    const errors = validateSignup({ name: "Dae", email: "dae@example.com", password: "1234567" });
    expect(errors.password).toMatch(/at least 8/);
  });

  test("rejects a blank name and a malformed email", () => {
    const errors = validateSignup({ name: "  ", email: "dae@", password: "longenough" });
    expect(errors.name).toBeDefined();
    expect(errors.email).toBeDefined();
  });

  test("requires both email and password to log in", () => {
    const errors = validateLogin({ email: "", password: "" });
    expect(errors.email).toBeDefined();
    expect(errors.password).toBeDefined();
  });

  test("recognises valid and invalid email shapes", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("a b@c.co")).toBe(false);
    expect(isValidEmail("nobody")).toBe(false);
  });
});

describe("draft invoice validation", () => {
  test("accepts a complete draft", () => {
    expect(hasErrors(validateDraft(validDraft))).toBe(false);
  });

  test("rejects a quantity of zero", () => {
    const form = { ...validDraft, items: [{ ...validDraft.items[0]!, quantity: "0" }] };
    expect(validateDraft(form).items).toMatch(/greater than 0/);
  });

  test("rejects a negative or non-numeric price but allows a free line", () => {
    const withPrice = (unit_price: string) => ({ ...validDraft, items: [{ ...validDraft.items[0]!, unit_price }] });
    expect(validateDraft(withPrice("-10")).items).toBeDefined();
    expect(validateDraft(withPrice("abc")).items).toBeDefined();
    expect(validateDraft(withPrice("0")).items).toBeUndefined();
  });

  test("requires a due date, a client email and at least one line item", () => {
    const errors = validateDraft({ ...validDraft, due_date: "", recipient_email: "nope", items: [] });
    expect(errors.due_date).toBeDefined();
    expect(errors.recipient_email).toBeDefined();
    expect(errors.items).toMatch(/at least one/);
  });
});

describe("chat message validation", () => {
  test("rejects an empty message and one over the contract limit", () => {
    expect(validateChatMessage("   ")).toBeDefined();
    expect(validateChatMessage("x".repeat(MAX_CHAT_MESSAGE_LENGTH + 1))).toBeDefined();
    expect(validateChatMessage("Bill Acme $500")).toBeUndefined();
  });
});
