import type { ReactNode } from "react";
import { cx } from "../lib/cx";

export type StatusTone = "muted" | "green" | "amber" | "red";

const TONES: Record<StatusTone, string> = {
  muted: "text-muted",
  green: "text-accent",
  amber: "text-amber",
  red: "text-danger",
};

/** Status as plain words. Colour only reinforces what the text already says. */
export function StatusText({ tone, children, className }: { tone: StatusTone; children: ReactNode; className?: string }) {
  return <span className={cx("whitespace-nowrap", TONES[tone], className)}>{children}</span>;
}
