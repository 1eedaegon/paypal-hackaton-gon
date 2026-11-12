const SECTION = "mx-auto max-w-6xl px-4 sm:px-6";
const HEADING = "text-2xl font-medium tracking-tight text-balance sm:text-3xl";

const PAINS = [
  {
    title: "The invoice goes out late",
    body: "The job is done on Friday. The invoice gets written the week after, when there's finally a quiet hour.",
  },
  {
    title: "Chasing feels personal",
    body: "You like this client. Writing “just checking in on that payment” for the third time is nobody's favourite email.",
  },
  {
    title: "Nobody is keeping track",
    body: "With five to ten clients, who is nine days late and who was already nudged lives in your head.",
  },
] as const;

export function Problem() {
  return (
    <section aria-labelledby="problem-heading" className="border-t border-line py-16 sm:py-20">
      <div className={SECTION}>
        <h2 id="problem-heading" className={`${HEADING} max-w-3xl`}>
          Late payment is rarely about the money. It's about the email you don't want to write.
        </h2>
        <ul className="mt-10 grid gap-8 md:grid-cols-3">
          {PAINS.map((pain) => (
            <li key={pain.title}>
              <h3 className="font-medium">{pain.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{pain.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const STEPS = [
  {
    title: "Describe",
    body: "Paste the client's message or say what to bill in plain words. The agent drafts the invoice: client, line items, due date.",
  },
  {
    title: "Approve",
    body: "The draft is an editable card. Fix anything, then press Approve & send. It goes out as a real PayPal invoice.",
  },
  {
    title: "Agent follows up",
    body: "Tell it your policy once. It reviews every unpaid invoice, drafts the right reminder, and explains why.",
  },
  {
    title: "Paid",
    body: "When the client pays on PayPal, the invoice flips to Paid on your board by itself. No refreshing, no bookkeeping.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-20 border-t border-line py-16 sm:py-20">
      <div className={SECTION}>
        <h2 id="how-heading" className={HEADING}>
          How it works
        </h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <p className="money text-sm text-muted" aria-hidden="true">
                {index + 1}
              </p>
              <h3 className="mt-1 font-medium">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const CONTROLS = [
  {
    title: "Every invoice needs your approval",
    body: "The agent only drafts. A new invoice is never created or sent until you press Approve & send.",
  },
  {
    title: "Reminders wait for you, unless you say otherwise",
    body: "Each proposed reminder lands in an approvals inbox where you can edit, approve or reject it. Turn on auto-send when you trust the policy.",
  },
  {
    title: "A full activity log",
    body: "Everything the agent, you and PayPal did is recorded in order, with the agent's reasoning for each decision.",
  },
] as const;

export function Control() {
  return (
    <section aria-labelledby="control-heading" className="border-t border-line py-16 sm:py-20">
      <div className={`${SECTION} grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16`}>
        <div>
          <h2 id="control-heading" className={HEADING}>
            You stay in control
          </h2>
          <p className="mt-4 leading-relaxed text-muted">
            Client relationships are yours. Duely does the remembering and the drafting. You decide what gets sent.
          </p>
        </div>
        <ul className="divide-y divide-line border-y border-line">
          {CONTROLS.map((control) => (
            <li key={control.title} className="py-5">
              <h3 className="font-medium">{control.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{control.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
