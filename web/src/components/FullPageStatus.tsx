import { LoaderCircle } from "lucide-react";

export function FullPageStatus({ label }: { label: string }) {
  return (
    <div role="status" className="flex min-h-dvh items-center justify-center gap-3 text-sm text-muted">
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      {label}…
    </div>
  );
}
