import { useId } from "react";
import { cx } from "../../lib/cx";

interface AutoSendToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function AutoSendToggle({ checked, onChange, disabled = false }: AutoSendToggleProps) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-paper p-4">
      <div>
        <p id={labelId} className="text-sm font-medium text-ink">
          Auto-send reminders
          <span className="ml-2 text-xs font-normal text-muted">{checked ? "On" : "Off"}</span>
        </p>
        <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-ink-soft">
          Reminders are sent without waiting for your approval. New invoices always need your approval.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-60",
          checked ? "border-accent bg-accent" : "border-line-strong bg-slate-soft",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 left-0.5 size-4.5 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}
