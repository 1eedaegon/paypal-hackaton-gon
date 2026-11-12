# Duely API contract

Single origin. The Rust server serves the SPA (`web/dist`) and the JSON API under `/api`.
Auth is a session cookie (`duely_session`, HttpOnly, SameSite=Lax). All requests with a body send `Content-Type: application/json`.

## Envelope

```jsonc
// success
{ "ok": true, "data": { /* ... */ } }
// failure (HTTP status is also set: 400, 401, 404, 409, 429, 502, 500)
{ "ok": false, "error": { "code": "invalid_input", "message": "Human readable, safe to show" } }
```

Error codes: `invalid_input`, `unauthorized`, `not_found`, `conflict`, `quota_exceeded`, `rate_limited`, `upstream_error`, `internal`.

## Types

```ts
type Money = string;            // decimal string, e.g. "500.00". Currency is always USD in this version.
type ISODate = string;          // "2026-11-12"
type ISODateTime = string;      // RFC 3339

interface User { id: string; email: string; name: string }

interface InvoiceItem { name: string; quantity: number; unit_price: Money }

type InvoiceStatus = "draft" | "sent" | "paid" | "cancelled";

interface Invoice {
  id: string;
  number: string | null;        // PayPal invoice number, null while draft
  status: InvoiceStatus;
  recipient_name: string;
  recipient_email: string;
  currency: "USD";
  items: InvoiceItem[];
  total: Money;
  due_date: ISODate;
  note: string;
  pay_url: string | null;       // PayPal hosted page where the client pays; null while draft
  is_overdue: boolean;          // status == "sent" and due_date < today
  days_overdue: number;         // 0 when not overdue
  reminder_count: number;
  last_reminded_at: ISODateTime | null;
  created_at: ISODateTime;
  sent_at: ISODateTime | null;
  paid_at: ISODateTime | null;
}

type ActionKind = "remind" | "wait";
type ActionStatus = "pending" | "executed" | "rejected" | "failed" | "superseded";

// A follow-up the agent proposes for one invoice. "remind" sends a PayPal reminder
// with the given subject/message once approved. "wait" is a recorded decision to hold off.
interface Action {
  id: string;
  invoice_id: string;
  invoice: { number: string | null; recipient_name: string; total: Money; days_overdue: number };
  kind: ActionKind;
  subject: string;              // "" for wait
  message: string;              // "" for wait
  reasoning: string;            // why the agent chose this
  status: ActionStatus;
  error: string | null;
  created_at: ISODateTime;
  executed_at: ISODateTime | null;
}

interface Activity {
  id: string;
  invoice_id: string | null;
  actor: "agent" | "user" | "paypal" | "system";
  kind: string;                 // e.g. "invoice_drafted", "invoice_sent", "reminder_sent", "payment_received", "policy_updated", "decision_wait"
  summary: string;
  created_at: ISODateTime;
}

interface Policy { text: string; auto_send: boolean; updated_at: ISODateTime | null }

interface Summary {
  outstanding_total: Money;     // all sent, unpaid
  overdue_total: Money;
  paid_30d_total: Money;
  counts: { draft: number; sent: number; overdue: number; paid: number };
}

interface Usage { agent_calls_today: number; agent_daily_limit: number }

type Effect =
  | { type: "invoice_drafted"; invoice_id: string }
  | { type: "action_proposed"; action_id: string }
  | { type: "action_executed"; action_id: string }
  | { type: "policy_updated" };

interface ChatMessage { role: "user" | "assistant"; content: string }
```

## Endpoints

### Auth
| Method | Path | Body | Data |
|---|---|---|---|
| POST | `/api/auth/signup` | `{ email, password, name }` (password >= 8 chars) | `{ user: User }` |
| POST | `/api/auth/login` | `{ email, password }` | `{ user: User }` |
| POST | `/api/auth/logout` | – | `{}` |
| GET | `/api/auth/me` | – | `{ user: User }` or 401 |

### Workspace
| Method | Path | Body | Data |
|---|---|---|---|
| GET | `/api/dashboard` | – | `{ summary: Summary, invoices: Invoice[], pending_actions: Action[], usage: Usage }` |
| GET | `/api/invoices/:id` | – | `{ invoice: Invoice, actions: Action[], activity: Activity[] }` |
| PATCH | `/api/invoices/:id` | `{ recipient_name, recipient_email, items, due_date, note }` (draft only) | `{ invoice: Invoice }` |
| DELETE | `/api/invoices/:id` | – (draft only) | `{}` |
| POST | `/api/invoices/:id/send` | – creates the invoice in PayPal and sends it | `{ invoice: Invoice }` |
| POST | `/api/invoices/:id/record-payment` | – records a payment received outside PayPal (full amount) | `{ invoice: Invoice }` |
| POST | `/api/invoices/:id/sync` | – re-reads status from PayPal | `{ invoice: Invoice }` |
| GET | `/api/actions?status=pending` | – (`status` optional) | `{ actions: Action[] }` |
| PATCH | `/api/actions/:id` | `{ subject, message }` (pending remind only) | `{ action: Action }` |
| POST | `/api/actions/:id/approve` | – executes it (sends the PayPal reminder) | `{ action: Action }` |
| POST | `/api/actions/:id/reject` | – | `{ action: Action }` |
| GET | `/api/policy` | – | `{ policy: Policy }` |
| PUT | `/api/policy` | `{ text, auto_send }` | `{ policy: Policy }` |
| GET | `/api/activity?limit=50` | – | `{ activity: Activity[] }` |
| POST | `/api/demo/seed` | – creates sample sent/overdue invoices in PayPal for this user (once per user; 409 after) | `{ invoices: Invoice[] }` |

### Agent
| Method | Path | Body | Data |
|---|---|---|---|
| POST | `/api/agent/chat` | `{ messages: ChatMessage[] }` (full history, last is the user turn; max 20 messages, 6000 chars each) | `{ reply: string, effects: Effect[] }` |
| POST | `/api/agent/review` | – agent reviews every unpaid sent invoice against the policy and proposes one follow-up each | `{ reply: string, effects: Effect[] }` |

Both count against the per-user daily agent quota and return 429 `quota_exceeded` when it is used up.
The agent never sends a new invoice itself: it drafts, and the user approves with `POST /api/invoices/:id/send`.
Reminders are proposed as pending actions unless `policy.auto_send` is true, in which case they are executed immediately (`action_executed`).

### Webhook
`POST /api/webhooks/paypal` — PayPal calls this. Signature verified server side. Not used by the SPA.

## Behaviour notes for the SPA
- Poll `GET /api/dashboard` every 4 seconds while the app is visible so payments arriving by webhook show up without a reload.
- 401 from any endpoint means the session is gone: redirect to `/login`.
