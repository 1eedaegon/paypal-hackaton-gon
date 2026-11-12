import { useId } from "react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  tone?: "primary" | "danger";
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  pendingLabel,
  tone = "primary",
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  return (
    <Modal open={open} onClose={onCancel} labelledBy={titleId}>
      <div className="flex flex-col gap-3 p-6">
        <h2 id={titleId} className="font-display text-xl font-medium">
          {title}
        </h2>
        <div className="text-sm leading-relaxed text-ink-soft">{children}</div>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button variant={tone} onClick={onConfirm} pending={pending} pendingLabel={pendingLabel}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
