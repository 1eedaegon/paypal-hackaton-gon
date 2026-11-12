import { toCents } from "./format";
import { parseISODate } from "./format";

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_CHAT_MESSAGE_LENGTH = 6000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function hasErrors(errors: Record<string, unknown>): boolean {
  return Object.keys(errors).length > 0;
}

function emailError(email: string): string | undefined {
  if (email.trim() === "") {
    return "Enter your email address.";
  }
  return isValidEmail(email) ? undefined : "That doesn't look like an email address.";
}

/** Drops keys whose value is undefined so `hasErrors` can count keys. */
function compact<K extends string>(errors: Record<K, string | undefined>): FieldErrors<K> {
  const entries = Object.entries(errors).filter(([, message]) => message !== undefined);
  return Object.fromEntries(entries) as FieldErrors<K>;
}

export function validateLogin(input: { email: string; password: string }): FieldErrors<"email" | "password"> {
  return compact({
    email: emailError(input.email),
    password: input.password === "" ? "Enter your password." : undefined,
  });
}

export function validateSignup(input: {
  name: string;
  email: string;
  password: string;
}): FieldErrors<"name" | "email" | "password"> {
  const passwordTooShort = input.password.length < MIN_PASSWORD_LENGTH;
  return compact({
    name: input.name.trim() === "" ? "Enter your name." : undefined,
    email: emailError(input.email),
    password: passwordTooShort ? `Use at least ${MIN_PASSWORD_LENGTH} characters.` : undefined,
  });
}

export interface DraftItemForm {
  key: string;
  name: string;
  quantity: string;
  unit_price: string;
}

export interface DraftForm {
  recipient_name: string;
  recipient_email: string;
  due_date: string;
  note: string;
  items: DraftItemForm[];
}

export type DraftErrors = FieldErrors<"recipient_name" | "recipient_email" | "due_date" | "items">;

export function itemError(item: DraftItemForm): string | undefined {
  if (item.name.trim() === "") {
    return "Every line item needs a description.";
  }
  const quantity = Number(item.quantity);
  if (item.quantity.trim() === "" || !Number.isFinite(quantity) || quantity <= 0) {
    return "Quantity must be greater than 0.";
  }
  if (toCents(item.unit_price) === null) {
    return "Price must be 0 or more, with at most two decimals.";
  }
  return undefined;
}

function itemsError(items: DraftItemForm[]): string | undefined {
  if (items.length === 0) {
    return "Add at least one line item.";
  }
  return items.map(itemError).find((message) => message !== undefined);
}

export function validateDraft(form: DraftForm): DraftErrors {
  const emailProblem = isValidEmail(form.recipient_email) ? undefined : "Enter a valid client email.";
  return compact({
    recipient_name: form.recipient_name.trim() === "" ? "Enter the client's name." : undefined,
    recipient_email: emailProblem,
    due_date: parseISODate(form.due_date) ? undefined : "Choose a due date.",
    items: itemsError(form.items),
  });
}

export function validateChatMessage(text: string): string | undefined {
  if (text.trim() === "") {
    return "Write a message first.";
  }
  if (text.length > MAX_CHAT_MESSAGE_LENGTH) {
    return `Messages can be up to ${MAX_CHAT_MESSAGE_LENGTH.toLocaleString("en-US")} characters.`;
  }
  return undefined;
}
