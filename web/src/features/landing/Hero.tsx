import { Link } from "react-router";
import { buttonClass } from "../../components/Button";
import { HeroVisual } from "./HeroVisual";

export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-16 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-24">
      <div>
        <h1 className="font-serif text-[2.6rem] leading-[1.05] font-medium tracking-tight text-balance sm:text-6xl">
          Get paid on time. Skip the awkward chasing.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
          Duely is an AI collections agent for freelance designers, developers and translators who would rather do
          the work than chase the money. Describe the job, approve the invoice, and your agent follows up with
          clients politely, on your terms, until it's paid.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to={signedIn ? "/app" : "/signup"} className={buttonClass("primary", "lg")}>
            {signedIn ? "Open app" : "Get started free"}
          </Link>
          <a href="#how-it-works" className={buttonClass("secondary", "lg")}>
            See how it works
          </a>
        </div>
        <p className="mt-4 text-sm text-muted">Nothing reaches a client until you approve it.</p>
      </div>
      <HeroVisual />
    </section>
  );
}
