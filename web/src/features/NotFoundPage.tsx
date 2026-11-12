import { Link } from "react-router";
import { buttonClass } from "../components/Button";
import { Logo } from "../components/Logo";

export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo />
      <p className="money mt-4 text-sm font-medium text-muted">404</p>
      <h1 className="font-display text-4xl font-medium tracking-tight">This page isn't on the books</h1>
      <p className="max-w-sm text-ink-soft">The link may be old, or the address was mistyped.</p>
      <Link to="/" className={buttonClass("primary", "md", "mt-2")}>
        Back to home
      </Link>
    </main>
  );
}
