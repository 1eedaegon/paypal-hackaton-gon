import { MessageSquareText, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { useToast } from "../../components/Toast";
import { api } from "../../lib/api";
import { describeError, isApiError } from "../../lib/errors";
import { useWorkspace } from "../workspace/WorkspaceContext";

const STEP_INTERVAL_MS = 3000;
const SEED_STEPS = [
  "Setting up a few sample clients…",
  "Creating real invoices in the PayPal sandbox…",
  "Sending them so they can be paid…",
  "Waiting for PayPal to confirm…",
  "Almost there…",
] as const;

function SeedProgress() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setStep((current) => Math.min(current + 1, SEED_STEPS.length - 1));
    }, STEP_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div role="status" className="mt-4 w-full max-w-sm">
      <div className="h-1.5 overflow-hidden rounded-full bg-paper-deep">
        <div className="animate-indeterminate h-full w-2/5 rounded-full bg-accent" />
      </div>
      <p className="mt-2 text-sm text-ink-soft">{SEED_STEPS[step]}</p>
      <p className="text-xs text-muted">This takes about 10 seconds.</p>
    </div>
  );
}

/** First-run state: explains the first step and offers real sandbox sample data. */
export function SampleDataCard() {
  const { refresh, setTab } = useWorkspace();
  const toast = useToast();
  const [seeding, setSeeding] = useState(false);

  const loadSamples = async () => {
    setSeeding(true);
    try {
      const { invoices } = await api.seedDemo();
      toast.success(`Loaded ${invoices.length} sample invoices. Try "Run collection review" next.`);
    } catch (error) {
      const alreadyLoaded = isApiError(error, "conflict");
      toast.error(alreadyLoaded ? "Sample data has already been loaded for this account." : describeError(error));
    } finally {
      await refresh();
      setSeeding(false);
    }
  };

  return (
    <section className="flex flex-col items-center rounded-2xl border border-line bg-surface px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent">
        <MessageSquareText className="size-5" aria-hidden="true" />
      </span>
      <h2 className="mt-4 font-display text-2xl font-medium">Start with one message</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
        Paste what your client wrote, or tell the agent what to bill in your own words. Duely drafts the invoice and
        waits for your approval before anything is sent.
      </p>
      {seeding ? (
        <SeedProgress />
      ) : (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button variant="primary" className="lg:hidden" onClick={() => setTab("agent")}>
            Open the agent
          </Button>
          <Button icon={<Sparkles className="size-4" aria-hidden="true" />} onClick={loadSamples}>
            Load sample data
          </Button>
        </div>
      )}
      <p className="mt-4 max-w-sm text-xs leading-relaxed text-muted">
        Sample data creates a handful of real invoices in the PayPal sandbox, some already overdue, so you can see a
        collection review straight away.
      </p>
    </section>
  );
}
