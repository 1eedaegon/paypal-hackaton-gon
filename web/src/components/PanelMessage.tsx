import type { ReactNode } from "react";
import { cx } from "../lib/cx";

interface PanelMessageProps {
  tone?: "empty" | "loading" | "error";
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}

/** Plain placeholder text for empty, loading and failed states inside a panel. */
export function PanelMessage({ tone = "empty", title, children, action }: PanelMessageProps) {
  return (
    <div role={tone === "error" ? "alert" : tone === "loading" ? "status" : undefined} className="py-6">
      {title ? <h3 className="text-sm font-medium text-ink">{title}</h3> : null}
      <p className={cx("max-w-md text-sm leading-relaxed", tone === "error" ? "text-danger" : "text-muted", title && "mt-1")}>
        {children}
      </p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
