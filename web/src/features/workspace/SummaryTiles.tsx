import { cx } from "../../lib/cx";
import { formatMoney, pluralize } from "../../lib/format";
import type { Summary } from "../../lib/types";

interface TileProps {
  label: string;
  amount: string;
  detail: string;
  accent?: "amber" | "green";
}

const ACCENT_BAR = { amber: "bg-amber", green: "bg-accent" } as const;

function Tile({ label, amount, detail, accent }: TileProps) {
  return (
    <div className="relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-line bg-surface px-4 py-3 sm:block sm:px-5 sm:py-4">
      <span
        aria-hidden="true"
        className={cx("absolute inset-y-0 left-0 w-1", accent ? ACCENT_BAR[accent] : "bg-line-strong")}
      />
      <div>
        <dt className="text-sm font-medium text-ink-soft">{label}</dt>
        <p className="text-xs text-muted sm:hidden">{detail}</p>
      </div>
      <dd className="text-right sm:mt-1 sm:text-left">
        <span className="money font-display text-2xl font-medium tracking-tight xl:text-3xl">{amount}</span>
        <span className="mt-0.5 hidden text-xs text-muted sm:block">{detail}</span>
      </dd>
    </div>
  );
}

export function SummaryTiles({ summary }: { summary: Summary }) {
  const { counts } = summary;
  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      <Tile
        label="Outstanding"
        amount={formatMoney(summary.outstanding_total)}
        detail={`${pluralize(counts.sent, "invoice")} awaiting payment`}
      />
      <Tile
        label="Overdue"
        amount={formatMoney(summary.overdue_total)}
        detail={counts.overdue === 0 ? "Nothing is late" : `${pluralize(counts.overdue, "invoice")} past due`}
        accent={counts.overdue > 0 ? "amber" : undefined}
      />
      <Tile
        label="Paid, last 30 days"
        amount={formatMoney(summary.paid_30d_total)}
        detail={`${pluralize(counts.paid, "invoice")} paid in total`}
        accent="green"
      />
    </dl>
  );
}
