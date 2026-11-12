import { X } from "lucide-react";
import { useCallback, useId } from "react";
import { Modal } from "../../components/Modal";
import { PanelMessage } from "../../components/PanelMessage";
import { api } from "../../lib/api";
import { describeError } from "../../lib/errors";
import type { InvoiceDetail } from "../../lib/types";
import { usePolledResource } from "../../lib/usePolledResource";
import { ActivityList } from "../activity/ActivityList";
import { handledActions, needsApproval } from "../approvals/actionLogic";
import { HandledList } from "../approvals/HandledList";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { InvoiceActions } from "./InvoiceActions";
import { InvoiceFacts, ItemsTable } from "./InvoiceFacts";
import { invoiceLabel } from "./invoiceLogic";
import { PayLink } from "./PayLink";
import { StatusPill } from "./StatusPill";

const DETAIL_POLL_MS = 4000;
const SECTION_TITLE = "text-xs font-medium tracking-wide text-muted uppercase";

interface DrawerBodyProps {
  detail: InvoiceDetail;
  onChanged: () => Promise<void>;
  onClose: () => void;
}

function DrawerBody({ detail, onChanged, onClose }: DrawerBodyProps) {
  const { setTab } = useWorkspace();
  const reviewInApprovals = () => {
    setTab("approvals");
    onClose();
  };
  const { invoice, actions, activity } = detail;
  const pendingCount = actions.filter(needsApproval).length;
  const handled = handledActions(actions);
  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <InvoiceFacts invoice={invoice} />
      <ItemsTable invoice={invoice} />
      {invoice.note ? (
        <div>
          <h3 className={SECTION_TITLE}>Note to client</h3>
          <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">{invoice.note}</p>
        </div>
      ) : null}
      {invoice.pay_url ? <PayLink url={invoice.pay_url} /> : null}
      {invoice.status !== "draft" ? <InvoiceActions invoice={invoice} onChanged={onChanged} /> : null}
      {pendingCount > 0 ? (
        <p className="rounded-xl border border-amber-line bg-amber-soft px-3 py-2 text-sm text-amber">
          A reminder for this invoice is waiting for your approval.{" "}
          <button type="button" onClick={reviewInApprovals} className="rounded font-medium underline">
            Review it in Approvals
          </button>
        </p>
      ) : null}
      {handled.length > 0 ? (
        <section>
          <h3 className={SECTION_TITLE}>Agent follow-ups</h3>
          <div className="mt-2">
            <HandledList actions={handled} />
          </div>
        </section>
      ) : null}
      <section>
        <h3 className={SECTION_TITLE}>Timeline</h3>
        {activity.length > 0 ? (
          <ActivityList activity={activity} />
        ) : (
          <p className="mt-2 text-sm text-ink-soft">No activity recorded for this invoice yet.</p>
        )}
      </section>
    </div>
  );
}

function DrawerContent({ invoiceId, titleId, onClose }: { invoiceId: string; titleId: string; onClose: () => void }) {
  const { refresh: refreshDashboard } = useWorkspace();
  const load = useCallback(() => api.getInvoice(invoiceId), [invoiceId]);
  const { data, error, refresh } = usePolledResource(load, DETAIL_POLL_MS);

  const onChanged = useCallback(async () => {
    await Promise.all([refresh(), refreshDashboard()]);
  }, [refresh, refreshDashboard]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <p className="money text-xs text-muted">{data ? invoiceLabel(data.invoice) : "Invoice"}</p>
          <h2 id={titleId} className="truncate font-display text-2xl font-medium">
            {data ? data.invoice.recipient_name : "Loading…"}
          </h2>
          {data ? (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <StatusPill invoice={data.invoice} />
              <span className="truncate">{data.invoice.recipient_email}</span>
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close invoice details"
          className="rounded-md p-2 text-muted hover:bg-paper-deep hover:text-ink"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">
        {data ? (
          <DrawerBody detail={data} onChanged={onChanged} onClose={onClose} />
        ) : (
          <div className="p-5">
            <PanelMessage tone={error ? "error" : "loading"}>
              {error ? describeError(error) : "Loading invoice…"}
            </PanelMessage>
          </div>
        )}
      </div>
    </div>
  );
}

interface InvoiceDrawerProps {
  invoiceId: string | null;
  onClose: () => void;
}

export function InvoiceDrawer({ invoiceId, onClose }: InvoiceDrawerProps) {
  const titleId = useId();
  return (
    <Modal open={invoiceId !== null} onClose={onClose} labelledBy={titleId} variant="drawer">
      {invoiceId ? <DrawerContent key={invoiceId} invoiceId={invoiceId} titleId={titleId} onClose={onClose} /> : null}
    </Modal>
  );
}
