import { useState } from "react";
import { useToast } from "../../components/Toast";
import { api } from "../../lib/api";
import type { Invoice } from "../../lib/types";
import { useAsyncAction } from "../../lib/useAsyncAction";
import { hasErrors, validateDraft } from "../../lib/validation";
import type { DraftErrors, DraftForm } from "../../lib/validation";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { draftFormFromInvoice, draftFormToInput, isDraftChanged } from "./draftForm";

function signatureOf(invoice: Invoice): string {
  return JSON.stringify(draftFormToInput(draftFormFromInvoice(invoice)));
}

/** State and server actions for one editable draft invoice. */
export function useDraftEditor(invoice: Invoice) {
  const { refresh } = useWorkspace();
  const toast = useToast();
  const [form, setForm] = useState<DraftForm>(() => draftFormFromInvoice(invoice));
  const [saved, setSaved] = useState<DraftForm>(form);
  const [errors, setErrors] = useState<DraftErrors>({});
  const saving = useAsyncAction();
  const sending = useAsyncAction();
  const discarding = useAsyncAction();

  const dirty = isDraftChanged(form, saved);
  const busy = saving.pending || sending.pending || discarding.pending;

  // The server copy can change underneath us (the agent revises the draft, or the same draft is
  // edited in the other panel). Adopt it unless the user has unsaved edits here.
  const serverSignature = signatureOf(invoice);
  const [seenSignature, setSeenSignature] = useState(serverSignature);
  if (serverSignature !== seenSignature && !busy) {
    setSeenSignature(serverSignature);
    if (!dirty) {
      const next = draftFormFromInvoice(invoice);
      setForm(next);
      setSaved(next);
    }
  }

  const validate = (): boolean => {
    const found = validateDraft(form);
    setErrors(found);
    return !hasErrors(found);
  };

  const persist = async () => {
    await api.updateInvoice(invoice.id, draftFormToInput(form));
    setSaved(form);
  };

  const save = async () => {
    if (!validate()) {
      return;
    }
    const ok = await saving.run(persist);
    if (ok) {
      toast.success("Draft saved.");
      await refresh();
    }
  };

  const send = async () => {
    if (!validate()) {
      return;
    }
    const ok = await sending.run(async () => {
      if (dirty) {
        await persist();
      }
      await api.sendInvoice(invoice.id);
    });
    if (ok) {
      toast.success(`Invoice sent to ${form.recipient_name.trim()} through PayPal.`);
    }
    await refresh();
  };

  const discard = async (): Promise<boolean> => {
    const ok = await discarding.run(async () => {
      await api.deleteInvoice(invoice.id);
    });
    if (ok) {
      toast.success("Draft discarded.");
      await refresh();
    }
    return ok;
  };

  return {
    form,
    setForm,
    errors,
    dirty,
    busy,
    save,
    send,
    discard,
    saving: saving.pending,
    sending: sending.pending,
    discarding: discarding.pending,
  };
}
