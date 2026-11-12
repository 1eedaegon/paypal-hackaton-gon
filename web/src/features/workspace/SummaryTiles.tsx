import { formatMoney, pluralize } from "../../lib/format";
import type { Summary } from "../../lib/types";

interface FigureProps {
  label: string;
  amount: string;
  caption: string;
}

function Figure({ label, amount, caption }: FigureProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-3 sm:block sm:px-5 sm:py-1 sm:first:pl-0">
      <div>
        <dt className="text-sm text-muted">{label}</dt>
        <p className="text-xs text-muted sm:hidden">{caption}</p>
      </div>
      <dd className="text-right sm:mt-1 sm:text-left">
        <span className="money text-2xl font-medium tracking-tight xl:text-3xl">{amount}</span>
        <span className="mt-1 hidden text-xs text-muted sm:block">{caption}</span>
      </dd>
    </div>
  );
}

/** Three figures in a row, separated by hairlines. */
export function SummaryTiles({ summary }: { summary: Summary }) {
  const { counts } = summary;
  return (
    <dl className="grid divide-y divide-line border-y border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:border-y-0">
      <Figure
        label="Outstanding"
        amount={formatMoney(summary.outstanding_total)}
        caption={`${pluralize(counts.sent, "invoice")} awaiting payment`}
      />
      <Figure
        label="Overdue"
        amount={formatMoney(summary.overdue_total)}
        caption={counts.overdue === 0 ? "Nothing is late" : `${pluralize(counts.overdue, "invoice")} past due`}
      />
      <Figure
        label="Paid, last 30 days"
        amount={formatMoney(summary.paid_30d_total)}
        caption={`${pluralize(counts.paid, "invoice")} paid in total`}
      />
    </dl>
  );
}
