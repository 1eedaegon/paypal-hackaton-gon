import { useMemo } from "react";
import { pluralize } from "../../lib/format";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { DraftCard } from "./DraftCard";
import { splitDrafts } from "./invoiceLogic";
import { InvoiceTable } from "./InvoiceTable";
import { SampleDataCard } from "./SampleDataCard";

export function ReceivablesTab() {
  const { dashboard, openInvoice } = useWorkspace();
  const { drafts, issued } = useMemo(() => splitDrafts(dashboard.invoices), [dashboard.invoices]);

  if (dashboard.invoices.length === 0) {
    return <SampleDataCard />;
  }

  return (
    <div className="flex flex-col gap-8">
      {drafts.length > 0 ? (
        <section aria-labelledby="drafts-heading" className="flex flex-col gap-3">
          <div>
            <h2 id="drafts-heading" className="text-base font-medium">
              Waiting for your approval
            </h2>
            <p className="text-sm text-muted">
              {pluralize(drafts.length, "draft")} from the agent. Nothing is sent until you approve it.
            </p>
          </div>
          {drafts.map((draft) => (
            <DraftCard key={draft.id} invoice={draft} />
          ))}
        </section>
      ) : null}
      <section aria-labelledby="invoices-heading" className="flex flex-col gap-3">
        <h2 id="invoices-heading" className="text-base font-medium">
          Invoices
        </h2>
        {issued.length > 0 ? (
          <InvoiceTable invoices={issued} onOpen={openInvoice} />
        ) : (
          <p className="text-sm text-muted">
            No invoices sent yet. Approve a draft above and it will appear here.
          </p>
        )}
      </section>
    </div>
  );
}
