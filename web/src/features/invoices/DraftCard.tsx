import { useState } from "react";
import { Button } from "../../components/Button";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { TextAreaField, TextField } from "../../components/Field";
import { formatCents } from "../../lib/format";
import type { Invoice } from "../../lib/types";
import type { DraftForm } from "../../lib/validation";
import { draftTotalCents } from "./draftForm";
import { DraftItemsEditor } from "./DraftItemsEditor";
import { useDraftEditor } from "./useDraftEditor";

/** Editable draft invoice. Nothing reaches the client until "Approve & send" is pressed. */
export function DraftCard({ invoice }: { invoice: Invoice }) {
  const editor = useDraftEditor(invoice);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const { form, errors, busy } = editor;

  const setField = <K extends keyof DraftForm>(field: K, value: DraftForm[K]) => {
    editor.setForm((current) => ({ ...current, [field]: value }));
  };

  const confirmDiscard = async () => {
    await editor.discard();
    setConfirmingDiscard(false);
  };

  return (
    <article className="@container rounded-lg border border-line bg-surface" aria-label="Draft invoice">
      <p className="border-b border-line px-4 py-2.5 text-sm text-muted">
        Draft, not sent yet. Edit anything, then approve.
      </p>
      <div className="flex flex-col gap-4 p-4">
        <div className="grid gap-3 @lg:grid-cols-2">
          <TextField
            label="Client name"
            value={form.recipient_name}
            onValueChange={(value) => setField("recipient_name", value)}
            error={errors.recipient_name}
            disabled={busy}
          />
          <TextField
            label="Client email"
            type="email"
            value={form.recipient_email}
            onValueChange={(value) => setField("recipient_email", value)}
            error={errors.recipient_email}
            disabled={busy}
          />
        </div>
        <DraftItemsEditor
          items={form.items}
          onChange={(items) => setField("items", items)}
          error={errors.items}
          disabled={busy}
        />
        <div className="grid gap-3 @lg:grid-cols-[12rem_1fr]">
          <TextField
            label="Due date"
            type="date"
            value={form.due_date}
            onValueChange={(value) => setField("due_date", value)}
            error={errors.due_date}
            disabled={busy}
          />
          <TextAreaField
            label="Note to client (optional)"
            rows={2}
            value={form.note}
            onValueChange={(value) => setField("note", value)}
            disabled={busy}
          />
        </div>
      </div>
      <footer className="flex flex-col gap-3 border-t border-line px-4 py-3 @lg:flex-row @lg:items-center @lg:justify-between">
        <p className="flex items-baseline gap-2">
          <span className="text-sm text-muted">Total</span>
          <span className="money text-xl font-medium">{formatCents(draftTotalCents(form))}</span>
          <span className="text-xs text-muted">USD</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setConfirmingDiscard(true)} disabled={busy}>
            Discard
          </Button>
          {editor.dirty ? (
            <Button size="sm" onClick={editor.save} pending={editor.saving} pendingLabel="Saving…" disabled={busy}>
              Save changes
            </Button>
          ) : null}
          <Button
            variant="primary"
            size="sm"
            onClick={editor.send}
            pending={editor.sending}
            pendingLabel="Sending through PayPal…"
            disabled={busy}
          >
            Approve &amp; send
          </Button>
        </div>
      </footer>
      <ConfirmDialog
        open={confirmingDiscard}
        title="Discard this draft?"
        confirmLabel="Discard draft"
        pendingLabel="Discarding…"
        tone="danger"
        pending={editor.discarding}
        onConfirm={confirmDiscard}
        onCancel={() => setConfirmingDiscard(false)}
      >
        The draft for {form.recipient_name || "this client"} will be deleted. Nothing has been sent, so your client
        won't see anything.
      </ConfirmDialog>
    </article>
  );
}
