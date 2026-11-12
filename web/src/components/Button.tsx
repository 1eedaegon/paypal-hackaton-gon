import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cx } from "../lib/cx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  pending?: boolean;
  pendingLabel?: string;
}

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-strong border border-accent",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-paper-deep",
  ghost: "text-muted hover:text-ink border border-transparent",
  danger: "bg-surface text-danger border border-line-strong hover:bg-paper-deep",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-10 px-4 text-sm",
  lg: "min-h-11 px-5 text-base",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", extra?: string): string {
  return cx(BASE, VARIANTS[variant], SIZES[size], extra);
}

export function Button({
  variant = "secondary",
  size = "md",
  pending = false,
  pendingLabel,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...rest}
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
