import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { TextAreaField } from "../../components/Field";
import { PanelMessage } from "../../components/PanelMessage";
import { useToast } from "../../components/Toast";
import { api } from "../../lib/api";
import { describeError } from "../../lib/errors";
import { formatDateTime } from "../../lib/format";
import type { Policy } from "../../lib/types";
import { useAsyncAction } from "../../lib/useAsyncAction";
import { AutoSendToggle } from "./AutoSendToggle";

const EXAMPLE_POLICY =
  "Polite nudge 3 days after the due date, a firmer reminder at 10 days. Give repeat clients one extra week.";

interface PolicyTabProps {
  /** Bumped by the agent panel when a chat changed the policy, so this tab reloads it. */
  reloadKey: number;
}

export function PolicyTab({ reloadKey }: PolicyTabProps) {
  const toast = useToast();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [text, setText] = useState("");
  const [autoSend, setAutoSend] = useState(false);
  const saving = useAsyncAction();

  useEffect(() => {
    let cancelled = false;
    const apply = (next: Policy) => {
      if (cancelled) {
        return;
      }
      setPolicy(next);
      setText(next.text);
      setAutoSend(next.auto_send);
      setLoadError(null);
    };
    api.getPolicy().then(
      ({ policy: loaded }) => apply(loaded),
      (error: unknown) => {
        if (!cancelled) {
          setLoadError(error);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (!policy) {
    return loadError ? (
      <PanelMessage tone="error">{describeError(loadError)}</PanelMessage>
    ) : (
      <PanelMessage tone="loading">Loading your policy…</PanelMessage>
    );
  }

  const dirty = text !== policy.text || autoSend !== policy.auto_send;

  const save = async () => {
    const ok = await saving.run(async () => {
      const { policy: next } = await api.savePolicy({ text: text.trim(), auto_send: autoSend });
      setPolicy(next);
      setText(next.text);
      setAutoSend(next.auto_send);
    });
    if (ok) {
      toast.success("Policy saved. The agent will follow it on the next review.");
    }
  };

  return (
    <section aria-labelledby="policy-heading" className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5">
      <div>
        <h2 id="policy-heading" className="font-display text-xl font-medium">
          Collection policy
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Tell the agent how you like to follow up, in your own words. It reads this before every review.
        </p>
      </div>
      <TextAreaField
        label="How should Duely follow up on unpaid invoices?"
        rows={6}
        value={text}
        onValueChange={setText}
        placeholder={EXAMPLE_POLICY}
        hint={`Example: "${EXAMPLE_POLICY}"`}
        disabled={saving.pending}
      />
      <AutoSendToggle checked={autoSend} onChange={setAutoSend} disabled={saving.pending} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-xs text-muted">
          {policy.updated_at ? `Last updated ${formatDateTime(policy.updated_at)}` : "Not saved yet"}
        </p>
        <Button variant="primary" onClick={save} pending={saving.pending} pendingLabel="Saving…" disabled={!dirty}>
          Save policy
        </Button>
      </div>
    </section>
  );
}
