import { useId } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Button } from "../../components/Button";
import { cx } from "../../lib/cx";
import { MAX_CHAT_MESSAGE_LENGTH } from "../../lib/validation";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  disabled: boolean;
}

const COUNTER_THRESHOLD = MAX_CHAT_MESSAGE_LENGTH - 500;

export function Composer({ value, onChange, onSubmit, pending, disabled }: ComposerProps) {
  const inputId = useId();
  const tooLong = value.length > MAX_CHAT_MESSAGE_LENGTH;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-line-strong bg-surface focus-within:border-accent">
      <label htmlFor={inputId} className="sr-only">
        Message to the Duely agent
      </label>
      <textarea
        id={inputId}
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={submitOnEnter}
        disabled={disabled}
        placeholder="Paste a client message or tell Duely what to bill..."
        className="block w-full resize-none rounded-t-lg bg-transparent px-3 pt-3 pb-1 text-sm leading-relaxed text-ink placeholder:text-muted focus:outline-none disabled:text-muted"
      />
      <div className="flex items-center justify-between gap-2 px-2 pb-2">
        <p className={cx("pl-1 text-xs", tooLong ? "text-danger" : "text-muted")}>
          {value.length > COUNTER_THRESHOLD
            ? `${value.length.toLocaleString("en-US")} / ${MAX_CHAT_MESSAGE_LENGTH.toLocaleString("en-US")}`
            : "Enter to send, Shift+Enter for a new line"}
        </p>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          pending={pending}
          disabled={disabled || tooLong || value.trim() === ""}
        >
          Send
        </Button>
      </div>
    </form>
  );
}
