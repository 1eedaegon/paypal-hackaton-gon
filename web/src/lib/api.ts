// Typed API client. One function per endpoint in docs/api.md.
import { request } from "./http";
import type {
  Action,
  ActionStatus,
  Activity,
  AgentResult,
  ChatMessage,
  Dashboard,
  Invoice,
  InvoiceDetail,
  InvoiceDraftInput,
  Policy,
  User,
} from "./types";

export { ApiError, setUnauthorizedHandler } from "./http";
export type { ApiErrorCode } from "./http";

const DEFAULT_ACTIVITY_LIMIT = 50;

const invoicePath = (id: string) => `/api/invoices/${encodeURIComponent(id)}`;
const actionPath = (id: string) => `/api/actions/${encodeURIComponent(id)}`;

export const api = {
  signup: (input: { email: string; password: string; name: string }) =>
    request<{ user: User }>("POST", "/api/auth/signup", input),
  login: (input: { email: string; password: string }) => request<{ user: User }>("POST", "/api/auth/login", input),
  logout: () => request<Record<string, never>>("POST", "/api/auth/logout"),
  me: () => request<{ user: User }>("GET", "/api/auth/me"),

  dashboard: () => request<Dashboard>("GET", "/api/dashboard"),

  getInvoice: (id: string) => request<InvoiceDetail>("GET", invoicePath(id)),
  updateInvoice: (id: string, input: InvoiceDraftInput) =>
    request<{ invoice: Invoice }>("PATCH", invoicePath(id), input),
  deleteInvoice: (id: string) => request<Record<string, never>>("DELETE", invoicePath(id)),
  sendInvoice: (id: string) => request<{ invoice: Invoice }>("POST", `${invoicePath(id)}/send`),
  recordPayment: (id: string) => request<{ invoice: Invoice }>("POST", `${invoicePath(id)}/record-payment`),
  syncInvoice: (id: string) => request<{ invoice: Invoice }>("POST", `${invoicePath(id)}/sync`),

  listActions: (status?: ActionStatus) =>
    request<{ actions: Action[] }>("GET", status ? `/api/actions?status=${status}` : "/api/actions"),
  updateAction: (id: string, input: { subject: string; message: string }) =>
    request<{ action: Action }>("PATCH", actionPath(id), input),
  approveAction: (id: string) => request<{ action: Action }>("POST", `${actionPath(id)}/approve`),
  rejectAction: (id: string) => request<{ action: Action }>("POST", `${actionPath(id)}/reject`),

  getPolicy: () => request<{ policy: Policy }>("GET", "/api/policy"),
  savePolicy: (input: { text: string; auto_send: boolean }) => request<{ policy: Policy }>("PUT", "/api/policy", input),

  listActivity: (limit: number = DEFAULT_ACTIVITY_LIMIT) =>
    request<{ activity: Activity[] }>("GET", `/api/activity?limit=${limit}`),

  seedDemo: () => request<{ invoices: Invoice[] }>("POST", "/api/demo/seed"),

  agentChat: (messages: ChatMessage[]) => request<AgentResult>("POST", "/api/agent/chat", { messages }),
  agentReview: () => request<AgentResult>("POST", "/api/agent/review"),
};
