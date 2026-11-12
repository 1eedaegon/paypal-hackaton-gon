import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { buttonClass, Button } from "../../components/Button";
import { useToast } from "../../components/Toast";

const COPIED_RESET_MS = 2000;

/** The PayPal hosted page where the client pays. Opens in a new tab; can be copied. */
export function PayLink({ url }: { url: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {
      toast.error("Couldn't copy the link. Select it and copy it by hand.");
    }
  };

  return (
    <div className="rounded-xl border border-line bg-paper p-3">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">PayPal payment link</p>
      <p className="mt-1 text-sm break-all text-ink-soft select-all">{url}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
          <ExternalLink className="size-4" aria-hidden="true" />
          Open payment page
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        <Button
          size="sm"
          onClick={copy}
          icon={
            copied ? (
              <Check className="size-4 text-accent" aria-hidden="true" />
            ) : (
              <Copy className="size-4" aria-hidden="true" />
            )
          }
        >
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </div>
  );
}
