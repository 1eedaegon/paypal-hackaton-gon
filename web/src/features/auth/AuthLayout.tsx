import type { ReactNode } from "react";
import { Link } from "react-router";
import { Logo } from "../../components/Logo";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
        <Link to="/" aria-label="Duely home" className="inline-flex rounded-md">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:pt-14">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{subtitle}</p>
          <div className="mt-6">{children}</div>
          <p className="mt-4 text-sm text-ink-soft">{footer}</p>
          <p className="mt-8 border-t border-line pt-4 text-xs leading-relaxed text-muted">
            This demo runs on the PayPal sandbox. No real money moves, and nothing is sent to a client until you
            approve it.
          </p>
        </div>
      </main>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <p role="alert" className="text-sm text-danger">
      {message}
    </p>
  );
}
