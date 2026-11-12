import { useEffect, useRef } from "react";
import type { MouseEvent, ReactNode } from "react";
import { cx } from "../lib/cx";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  variant?: "center" | "drawer";
  children: ReactNode;
}

const VARIANT_CLASS = {
  center: "m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line-strong",
  drawer: "mr-0 ml-auto h-dvh max-h-none w-full max-w-xl border-l border-line-strong",
} as const;

/** Native <dialog>: the browser handles focus trapping, Escape and inert background. */
export function Modal({ open, onClose, labelledBy, variant = "center", children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || typeof dialog.showModal !== "function") {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const closeOnBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === ref.current) {
      onClose();
    }
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onCancel={onClose}
      onClick={closeOnBackdrop}
      className={cx("bg-surface p-0 text-ink shadow-2xl shadow-ink/20", VARIANT_CLASS[variant])}
    >
      {open ? children : null}
    </dialog>
  );
}
