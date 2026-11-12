import type { ReactNode } from "react";
import { cx } from "../lib/cx";

export type PillTone = "neutral" | "green" | "amber" | "red" | "outline";

const TONES: Record<PillTone, string> = {
  neutral: "bg-slate-soft text-ink-soft border-transparent",
  green: "bg-accent-soft text-accent-strong border-transparent",
  amber: "bg-amber-soft text-amber border-amber-line",
  red: "bg-danger-soft text-danger border-transparent",
  outline: "bg-surface text-ink-soft border-line-strong",
};

interface PillProps {
  tone?: PillTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Status is always carried by the text label; colour and icon only reinforce it. */
export function Pill({ tone = "neutral", icon, children, className }: PillProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
