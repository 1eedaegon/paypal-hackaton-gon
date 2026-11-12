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
    <div>
      <p className="text-xs text-muted">PayPal payment link</p>
      <p className="mt-1 text-sm break-all text-ink select-all">{url}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
          Open payment page
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        <Button size="sm" onClick={copy}>
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </div>
  );
}
