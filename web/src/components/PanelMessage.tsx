import { LoaderCircle, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "../lib/cx";

interface PanelMessageProps {
  tone?: "empty" | "loading" | "error";
  icon?: ReactNode;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}

/** Centered placeholder for empty, loading and failed states inside a panel. */
export function PanelMessage({ tone = "empty", icon, title, children, action }: PanelMessageProps) {
  const resolvedIcon =
    tone === "loading" ? (
      <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
    ) : tone === "error" ? (
      <TriangleAlert className="size-5" aria-hidden="true" />
    ) : (
      icon
    );
  return (
    <div
      role={tone === "error" ? "alert" : tone === "loading" ? "status" : undefined}
      className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center"
    >
      {resolvedIcon ? (
        <span className={cx("mb-1", tone === "error" ? "text-danger" : "text-muted")}>{resolvedIcon}</span>
      ) : null}
      {title ? <h3 className="font-display text-lg font-medium">{title}</h3> : null}
      <p className="max-w-md text-sm leading-relaxed text-ink-soft">{children}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
