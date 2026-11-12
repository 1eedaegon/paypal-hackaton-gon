import { Send } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/Button";
import { TextAreaField, TextField } from "../../components/Field";
import { Pill } from "../../components/Pill";
import { useToast } from "../../components/Toast";
import { api } from "../../lib/api";
import type { Action } from "../../lib/types";
import { useAsyncAction } from "../../lib/useAsyncAction";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { actionDisplay, validateReminder } from "./actionLogic";
import { ActionSummary, Reasoning } from "./ActionSummary";

interface ActionCardProps {
  action: Action;
  onHandled: () => void;
}

/** One pending reminder: edit the text, then approve (sends through PayPal) or reject. */
export function ActionCard({ action, onHandled }: ActionCardProps) {
  const { refresh, openInvoice } = useWorkspace();
  const toast = useToast();
  const [subject, setSubject] = useState(action.subject);
  const [message, setMessage] = useState(action.message);
  const [saved, setSaved] = useState({ subject: action.subject, message: action.message });
  const [error, setError] = useState<string | undefined>();
  const saving = useAsyncAction();
  const approving = useAsyncAction();
  const rejecting = useAsyncAction();

  const dirty = subject !== saved.subject || message !== saved.message;
  const busy = saving.pending || approving.pending || rejecting.pending;
  const display = actionDisplay(action);

  const validate = (): boolean => {
    const problem = validateReminder(subject, message);
    setError(problem);
    return problem === undefined;
  };

  const persist = async () => {
    const next = { subject: subject.trim(), message: message.trim() };
    await api.updateAction(action.id, next);
    setSaved({ subject, message });
  };

  const save = async () => {
    if (validate() && (await saving.run(persist))) {
      toast.success("Reminder text saved.");
    }
  };

  const finish = async (successMessage: string, ok: boolean) => {
    if (ok) {
      toast.success(successMessage);
    }
    await refresh();
    onHandled();
  };

  const approve = async () => {
    if (!validate()) {
      return;
    }
    const ok = await approving.run(async () => {
      if (dirty) {
        await persist();
      }
      await api.approveAction(action.id);
    });
    await finish(`Reminder sent to ${action.invoice.recipient_name} through PayPal.`, ok);
  };

  const reject = async () => {
    const ok = await rejecting.run(async () => {
      await api.rejectAction(action.id);
    });
    await finish("Reminder rejected. Nothing was sent.", ok);
  };

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line-strong bg-surface p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <ActionSummary action={action} onOpenInvoice={openInvoice} />
        <Pill tone={display.tone}>{display.label}</Pill>
      </header>
      <Reasoning text={action.reasoning} />
      <TextField label="Subject" value={subject} onValueChange={setSubject} disabled={busy} />
      <TextAreaField
        label="Message to client"
        rows={5}
        value={message}
        onValueChange={setMessage}
        disabled={busy}
        error={error}
      />
      <footer className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={reject} pending={rejecting.pending} disabled={busy}>
          Reject
        </Button>
        {dirty ? (
          <Button size="sm" onClick={save} pending={saving.pending} pendingLabel="Saving…" disabled={busy}>
            Save edits
          </Button>
        ) : null}
        <Button
          variant="primary"
          size="sm"
          icon={<Send className="size-4" aria-hidden="true" />}
          onClick={approve}
          pending={approving.pending}
          pendingLabel="Sending…"
          disabled={busy}
        >
          Approve &amp; send
        </Button>
      </footer>
    </article>
  );
}
