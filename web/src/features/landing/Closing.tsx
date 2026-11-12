import { ArrowRight, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { buttonClass } from "../../components/Button";
import { Logo } from "../../components/Logo";

const SECTION = "mx-auto max-w-6xl px-4 sm:px-6";
const REPO_URL = "https://github.com/1eedaegon/paypal-hackaton-gon";

export function BuiltOn() {
  return (
    <section aria-label="Technology and demo environment" className="border-b border-line py-12">
      <div className={`${SECTION} grid gap-6 md:grid-cols-2 md:gap-12`}>
        <div>
          <h2 className="text-sm font-medium tracking-wide text-muted uppercase">Built on</h2>
          <p className="mt-2 font-display text-2xl leading-snug font-medium">
            PayPal Invoicing, PayPal Webhooks, Google Gemini
          </p>
        </div>
        <p className="flex items-start gap-3 text-sm leading-relaxed text-ink-soft">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
          <span>
            <strong className="font-medium text-ink">This demo runs on the PayPal sandbox.</strong> Invoices,
            reminders and payments are real API calls, but no real money moves and no real client is contacted.
          </span>
        </p>
      </div>
    </section>
  );
}

export function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section aria-labelledby="cta-heading" className="py-20 sm:py-28">
      <div className={`${SECTION} flex flex-col items-center text-center`}>
        <h2 id="cta-heading" className="max-w-2xl font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl">
          Send the invoice today. Let Duely handle the follow-up.
        </h2>
        <p className="mt-4 max-w-xl text-lg text-ink-soft">
          Your first draft takes one message. Load the sample data to watch a full collection review in under a
          minute.
        </p>
        <Link to={signedIn ? "/app" : "/signup"} className={buttonClass("primary", "lg", "mt-8")}>
          {signedIn ? "Open app" : "Get started free"}
          <ArrowRight className="size-4" aria-hidden="true" />
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
          className="rounded font-medium text-ink-soft underline underline-offset-4 hover:text-ink"
        >
          Source on GitHub<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
    </footer>
  );
}
