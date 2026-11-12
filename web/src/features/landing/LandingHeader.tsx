import { Link } from "react-router";
import { buttonClass } from "../../components/Button";
import { Logo } from "../../components/Logo";

export function LandingHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" aria-label="Duely home" className="rounded-md">
          <Logo />
        </Link>
        <nav aria-label="Account" className="flex items-center gap-1 sm:gap-2">
          {signedIn ? (
            <Link to="/app" className={buttonClass("primary", "sm")}>
              Open app
            </Link>
          ) : (
            <>
              <Link to="/login" className={buttonClass("ghost", "sm")}>
                Log in
              </Link>
              <Link to="/signup" className={buttonClass("primary", "sm")}>
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
