import { BadgeCheck, CalendarClock, CircleDollarSign, MessageSquareText, Send, ThumbsUp } from "lucide-react";
import type { ReactNode } from "react";

const SECTION = "mx-auto max-w-6xl px-4 sm:px-6";
const EYEBROW = "text-sm font-medium tracking-wide text-accent uppercase";
const HEADING = "mt-3 font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl";

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
    <section aria-labelledby="problem-heading" className="border-y border-line bg-paper-deep/60 py-16 sm:py-20">
      <div className={SECTION}>
        <p className={EYEBROW}>The problem</p>
        <h2 id="problem-heading" className={`${HEADING} max-w-3xl`}>
          Late payment is rarely about the money. It's about the email you don't want to write.
        </h2>
        <ul className="mt-10 grid gap-8 md:grid-cols-3">
          {PAINS.map((pain) => (
            <li key={pain.title} className="border-t border-line-strong pt-4">
              <h3 className="font-medium">{pain.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{pain.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

interface Step {
  title: string;
  body: string;
  icon: ReactNode;
}

const STEPS: readonly Step[] = [
  {
    title: "Describe",
    body: "Paste the client's message or say what to bill in plain words. The agent drafts the invoice: client, line items, due date.",
    icon: <MessageSquareText className="size-5" aria-hidden="true" />,
  },
  {
    title: "Approve",
    body: "The draft is an editable card. Fix anything, then press Approve & send. It goes out as a real PayPal invoice.",
    icon: <ThumbsUp className="size-5" aria-hidden="true" />,
  },
  {
    title: "Agent follows up",
    body: "Tell it your policy once. It reviews every unpaid invoice, drafts the right reminder, and explains why.",
    icon: <CalendarClock className="size-5" aria-hidden="true" />,
  },
  {
    title: "Paid",
    body: "When the client pays on PayPal, the invoice flips to Paid on your board by itself. No refreshing, no bookkeeping.",
    icon: <CircleDollarSign className="size-5" aria-hidden="true" />,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="scroll-mt-20 py-16 sm:py-24">
      <div className={SECTION}>
        <p className={EYEBROW}>How it works</p>
        <h2 id="how-heading" className={HEADING}>
          From “job done” to “paid” in four steps
        </h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-center justify-between text-accent">
                <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft">{step.icon}</span>
                <span className="money font-display text-3xl text-line-strong" aria-hidden="true">
                  {index + 1}
                </span>
              </div>
              <h3 className="mt-4 font-display text-xl font-medium">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
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
    icon: <Send className="size-5" aria-hidden="true" />,
  },
  {
    title: "Reminders wait for you, unless you say otherwise",
    body: "Each proposed reminder lands in an approvals inbox where you can edit, approve or reject it. Turn on auto-send when you trust the policy.",
    icon: <ThumbsUp className="size-5" aria-hidden="true" />,
  },
  {
    title: "A full activity log",
    body: "Everything the agent, you and PayPal did is recorded in order, with the agent's reasoning for each decision.",
    icon: <BadgeCheck className="size-5" aria-hidden="true" />,
  },
] as const;

export function Control() {
  return (
    <section aria-labelledby="control-heading" className="bg-ink py-16 text-paper sm:py-24">
      <div className={`${SECTION} grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16`}>
        <div>
          <p className="text-sm font-medium tracking-wide text-accent-soft uppercase">You stay in control</p>
          <h2 id="control-heading" className={HEADING}>
            An agent that asks before it speaks for you
          </h2>
          <p className="mt-4 leading-relaxed text-paper/75">
            Client relationships are yours. Duely does the remembering and the drafting. You decide what gets sent.
          </p>
        </div>
        <ul className="flex flex-col divide-y divide-paper/15 border-y border-paper/15">
          {CONTROLS.map((control) => (
            <li key={control.title} className="flex gap-4 py-5">
              <span className="mt-0.5 text-accent-soft">{control.icon}</span>
              <div>
                <h3 className="font-medium">{control.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-paper/75">{control.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
