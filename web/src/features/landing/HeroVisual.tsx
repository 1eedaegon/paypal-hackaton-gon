import { formatMoney } from "../../lib/format";
import type { Invoice } from "../../lib/types";
import { InvoiceStatusText } from "../invoices/StatusText";

// Static sample data. The cards reuse the app's own status text, type and money formatting.
const SAMPLE_ITEMS = [
  { name: "Brand refresh, design", quantity: 1, amount: "2400.00" },
  { name: "Extra revision round", quantity: 2, amount: "300.00" },
] as const;

type StatusFields = Pick<Invoice, "status" | "is_overdue" | "days_overdue">;
const DRAFT: StatusFields = { status: "draft", is_overdue: false, days_overdue: 0 };
const OVERDUE: StatusFields = { status: "sent", is_overdue: true, days_overdue: 9 };
const PAID: StatusFields = { status: "paid", is_overdue: false, days_overdue: 0 };

const CARD = "rounded-lg border border-line bg-surface text-sm";
const FAKE_BUTTON = "inline-flex min-h-8 items-center rounded-lg px-3 text-xs font-medium";

function DraftInvoiceSample() {
  return (
    <div className={CARD}>
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
        <p className="font-medium">Northwind Studio</p>
        <InvoiceStatusText invoice={DRAFT} />
      </div>
      <ul className="px-4">
        {SAMPLE_ITEMS.map((item) => (
          <li key={item.name} className="flex justify-between gap-3 border-b border-line py-2.5">
            <span>
              {item.name} <span className="money text-muted">× {item.quantity}</span>
            </span>
            <span className="money">{formatMoney(item.amount)}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-end justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-xs text-muted">Total, due Nov 26</p>
          <p className="money text-xl font-medium">{formatMoney("2700.00")}</p>
        </div>
        <span className={`${FAKE_BUTTON} bg-accent text-white`}>Approve &amp; send</span>
      </div>
    </div>
  );
}

function AgentDecisionSample() {
  return (
    <div className={CARD}>
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
        <p>
          <span className="font-medium">Harbor &amp; Co.</span>{" "}
          <span className="money text-muted">· Invoice 0042 · {formatMoney("860.00")}</span>
        </p>
        <InvoiceStatusText invoice={OVERDUE} />
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">
        <div>
          <p className="text-xs text-muted">Agent's reasoning</p>
          <p className="mt-1 leading-relaxed">
            Nine days late with one polite nudge already sent. They're a repeat client, so your policy gives them an
            extra week before a firm tone. A second friendly reminder fits.
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Message to client</p>
          <p className="mt-1 leading-relaxed text-muted">
            Hi Dana, a quick note that invoice 0042 is still open. The PayPal link below takes a minute…
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <span className={`${FAKE_BUTTON} text-muted`}>Reject</span>
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
      aria-label="Product preview: a drafted invoice waiting for approval, a follow-up reminder suggested by the agent with its reasoning, and a line showing that a client has paid."
      className="mx-auto w-full max-w-md select-none lg:max-w-none"
    >
      <div aria-hidden="true" className="flex flex-col gap-3">
        <DraftInvoiceSample />
        <AgentDecisionSample />
        <p className="flex items-baseline justify-between gap-3 border-b border-line px-4 pb-3 text-sm">
          <span>
            <span className="font-medium">Lumen Labs</span>{" "}
            <span className="money text-muted">· Invoice 0040 · {formatMoney("1200.00")}</span>
          </span>
          <InvoiceStatusText invoice={PAID} />
        </p>
      </div>
    </div>
  );
}
