import { useAuth } from "../auth/AuthContext";
import { BuiltOn, FinalCta, LandingFooter } from "./Closing";
import { Hero } from "./Hero";
import { LandingHeader } from "./LandingHeader";
import { Control, HowItWorks, Problem } from "./Sections";

export function LandingPage() {
  const { status } = useAuth();
  const signedIn = status === "signed_in";
  return (
    <div className="min-h-dvh">
      <LandingHeader signedIn={signedIn} />
      <main>
        <Hero signedIn={signedIn} />
        <Problem />
        <HowItWorks />
        <Control />
        <BuiltOn />
        <FinalCta signedIn={signedIn} />
      </main>
      <LandingFooter />
    </div>
  );
}
