import { ChevronDown, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Logo } from "../../components/Logo";
import type { Usage, User } from "../../lib/types";
import { useAsyncAction } from "../../lib/useAsyncAction";
import { useAuth } from "../auth/AuthContext";

function UserMenu({ user }: { user: User }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const loggingOut = useAsyncAction();

  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOnOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const logOut = async () => {
    const ok = await loggingOut.run(logout);
    if (ok) {
      navigate("/", { replace: true });
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="true"
        className="inline-flex max-w-44 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium hover:bg-paper-deep"
      >
        <span className="truncate">{user.name}</span>
        <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden="true" />
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-60 rounded-xl border border-line-strong bg-surface p-2 shadow-lg shadow-ink/10">
          <p className="truncate px-2 pt-1 text-sm font-medium">{user.name}</p>
          <p className="truncate px-2 pb-2 text-xs text-muted">{user.email}</p>
          <button
            type="button"
            onClick={logOut}
            disabled={loggingOut.pending}
            className="flex w-full items-center gap-2 rounded-lg border-t border-line px-2 py-2 text-left text-sm hover:bg-paper-deep disabled:opacity-60"
          >
            <LogOut className="size-4 text-muted" aria-hidden="true" />
            {loggingOut.pending ? "Logging out…" : "Log out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function TopBar({ user, usage }: { user: User; usage: Usage }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" aria-label="Duely home" className="rounded-md">
          <Logo />
        </Link>
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted">
            <span className="hidden sm:inline">Agent calls today </span>
            <span className="sm:hidden">Agent </span>
            <span className="money font-medium text-ink-soft">
              {usage.agent_calls_today} / {usage.agent_daily_limit}
            </span>
          </p>
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
