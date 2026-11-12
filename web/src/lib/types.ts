// Mirrors docs/api.md. Do not change shapes here without changing the contract.

export type Money = string;
export type ISODate = string;
export type ISODateTime = string;

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface InvoiceItem {
  name: string;
  quantity: number;
  unit_price: Money;
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "cancelled";

export interface Invoice {
  id: string;
  number: string | null;
  status: InvoiceStatus;
  recipient_name: string;
  recipient_email: string;
  currency: "USD";
  items: InvoiceItem[];
  total: Money;
  due_date: ISODate;
  note: string;
  pay_url: string | null;
  is_overdue: boolean;
  days_overdue: number;
  reminder_count: number;
  last_reminded_at: ISODateTime | null;
  created_at: ISODateTime;
  sent_at: ISODateTime | null;
  paid_at: ISODateTime | null;
}

export type ActionKind = "remind" | "wait";
export type ActionStatus = "pending" | "executed" | "rejected" | "failed" | "superseded";

export interface ActionInvoiceRef {
  number: string | null;
  recipient_name: string;
  total: Money;
  days_overdue: number;
}

export interface Action {
  id: string;
  invoice_id: string;
  invoice: ActionInvoiceRef;
  kind: ActionKind;
  subject: string;
  message: string;
  reasoning: string;
  status: ActionStatus;
  error: string | null;
  created_at: ISODateTime;
  executed_at: ISODateTime | null;
}

export type Actor = "agent" | "user" | "paypal" | "system";

export interface Activity {
  id: string;
  invoice_id: string | null;
  actor: Actor;
  kind: string;
  summary: string;
  created_at: ISODateTime;
}

export interface Policy {
  text: string;
  auto_send: boolean;
  updated_at: ISODateTime | null;
}

export interface Summary {
  outstanding_total: Money;
  overdue_total: Money;
  paid_30d_total: Money;
  counts: { draft: number; sent: number; overdue: number; paid: number };
}

export interface Usage {
  agent_calls_today: number;
  agent_daily_limit: number;
}

export type Effect =
  | { type: "invoice_drafted"; invoice_id: string }
  | { type: "action_proposed"; action_id: string }
  | { type: "action_executed"; action_id: string }
  | { type: "policy_updated" };

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Dashboard {
  summary: Summary;
  invoices: Invoice[];
  pending_actions: Action[];
  usage: Usage;
}

export interface InvoiceDetail {
  invoice: Invoice;
  actions: Action[];
  activity: Activity[];
}

export interface AgentResult {
  reply: string;
  effects: Effect[];
}

export interface InvoiceDraftInput {
  recipient_name: string;
  recipient_email: string;
  items: InvoiceItem[];
  due_date: ISODate;
  note: string;
}
