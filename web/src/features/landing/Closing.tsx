import { Link } from "react-router";
import { buttonClass } from "../../components/Button";
import { Logo } from "../../components/Logo";

const SECTION = "mx-auto max-w-6xl px-4 sm:px-6";
const REPO_URL = "https://github.com/1eedaegon/paypal-hackaton-gon";

export function BuiltOn() {
  return (
    <section aria-label="Technology and demo environment" className="border-t border-line py-10">
      <div className={`${SECTION} flex max-w-6xl flex-col gap-2 text-sm leading-relaxed text-muted`}>
        <p>
          <span className="text-ink">Built on PayPal Invoicing and PayPal Webhooks.</span>
        </p>
        <p className="max-w-2xl">
          This demo runs on the PayPal sandbox. Invoices, reminders and payments are real API calls, but no real
          money moves and no real client is contacted.
        </p>
      </div>
    </section>
  );
}

export function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section aria-labelledby="cta-heading" className="border-t border-line py-16 sm:py-20">
      <div className={SECTION}>
        <h2 id="cta-heading" className="max-w-2xl text-2xl font-medium tracking-tight text-balance sm:text-3xl">
          Send the invoice today. Let Duely handle the follow-up.
        </h2>
        <p className="mt-3 max-w-xl text-muted">
          Your first draft takes one message. Load the sample data to watch a full collection review in under a
          minute.
        </p>
        <Link to={signedIn ? "/app" : "/signup"} className={buttonClass("primary", "lg", "mt-6")}>
          {signedIn ? "Open app" : "Get started free"}
        </Link>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-line">
      <div className={`${SECTION} flex flex-col items-start justify-between gap-4 py-8 text-sm text-muted sm:flex-row sm:items-center`}>
        <Logo className="text-ink" />
        <p>Built for the PayPal AI Hackathon</p>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded underline underline-offset-4 hover:text-ink"
        >
          Source on GitHub<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
    </footer>
  );
}
