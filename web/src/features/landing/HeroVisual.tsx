import { Bot, CircleCheck, Send } from "lucide-react";
import { Pill } from "../../components/Pill";
import { formatMoney } from "../../lib/format";
import type { Invoice } from "../../lib/types";
import { StatusPill } from "../invoices/StatusPill";

// Static sample data. The cards reuse the app's own pills, type and money formatting.
const SAMPLE_ITEMS = [
  { name: "Brand refresh, design", quantity: 1, amount: "2400.00" },
  { name: "Extra revision round", quantity: 2, amount: "300.00" },
] as const;

const DRAFT_STATUS: Pick<Invoice, "status" | "is_overdue" | "days_overdue"> = {
  status: "draft",
  is_overdue: false,
  days_overdue: 0,
};

const OVERDUE_STATUS: Pick<Invoice, "status" | "is_overdue" | "days_overdue"> = {
  status: "sent",
  is_overdue: true,
  days_overdue: 9,
};

const FAKE_BUTTON = "inline-flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium";

function DraftInvoiceSample() {
  return (
    <div className="rounded-2xl border border-line-strong bg-surface shadow-xl shadow-ink/5">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <p className="text-sm font-medium">Northwind Studio</p>
          <p className="text-xs text-muted">ana@northwind.example</p>
        </div>
        <StatusPill invoice={DRAFT_STATUS} />
      </div>
      <ul className="px-4 py-2 text-sm">
        {SAMPLE_ITEMS.map((item) => (
          <li key={item.name} className="flex justify-between gap-3 border-b border-line py-2 last:border-b-0">
            <span className="text-ink-soft">
              {item.name} <span className="money text-muted">× {item.quantity}</span>
            </span>
            <span className="money">{formatMoney(item.amount)}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-end justify-between gap-3 border-t border-line px-4 py-3">
        <div>
          <p className="text-xs text-muted">Due Nov 26</p>
          <p className="money font-display text-2xl font-medium">{formatMoney("2700.00")}</p>
        </div>
        <span className={`${FAKE_BUTTON} bg-accent text-white`}>
          <Send className="size-3.5" />
          Approve &amp; send
        </span>
      </div>
    </div>
  );
}

function AgentDecisionSample() {
  return (
    <div className="rounded-2xl border border-line-strong bg-surface shadow-xl shadow-ink/5">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <p className="text-sm font-medium">Harbor &amp; Co.</p>
          <p className="money text-xs text-muted">Invoice 0042 · {formatMoney("860.00")}</p>
        </div>
        <StatusPill invoice={OVERDUE_STATUS} />
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">
        <div className="rounded-lg border-l-2 border-accent bg-accent-soft/50 px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-accent-strong uppercase">
            <Bot className="size-3.5" />
            Why the agent suggests this
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Nine days late with one polite nudge already sent. They're a repeat client, so your policy gives them an
            extra week before a firm tone. A second friendly reminder fits.
          </p>
        </div>
        <p className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink-soft">
          “Hi Dana, a quick note that invoice 0042 is still open. The PayPal link below takes a minute…”
        </p>
        <div className="flex justify-end gap-2">
          <span className={`${FAKE_BUTTON} text-ink-soft`}>Reject</span>
          <span className={`${FAKE_BUTTON} border border-line-strong`}>Edit</span>
          <span className={`${FAKE_BUTTON} bg-accent text-white`}>Approve &amp; send</span>
        </div>
      </div>
    </div>
  );
}

export function HeroVisual() {
  return (
    <div
      role="img"
      aria-label="Product preview: a drafted invoice waiting for approval, a follow-up reminder suggested by the agent with its reasoning, and a notice that a client has paid."
      className="relative mx-auto w-full max-w-md select-none lg:max-w-none"
    >
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="lg:mr-14">
          <DraftInvoiceSample />
        </div>
        <div className="lg:-mt-2 lg:ml-14">
          <AgentDecisionSample />
        </div>
        <div className="flex justify-center lg:justify-start">
          <Pill tone="green" icon={<CircleCheck className="size-3.5" />} className="px-3 py-1.5 text-sm shadow-sm">
            Lumen Labs paid {formatMoney("1200.00")} on PayPal
          </Pill>
        </div>
      </div>
    </div>
  );
}
