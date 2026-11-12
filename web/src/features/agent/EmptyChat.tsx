const EXAMPLES = [
  {
    label: "Bill a project",
    text: "Bill Acme Studio $1,200 for the landing page redesign, due in 14 days. Their email is maya@acmestudio.example.",
  },
  {
    label: "Paste a client message",
    text: 'My client Jonas (jonas@nordwind.example) wrote: "The three blog translations look great. Please send the invoice, $180 each as agreed, we pay within 10 days."',
  },
  {
    label: "Ask who to chase",
    text: "Who owes me money right now, and who should I follow up with first?",
  },
  {
    label: "Set a policy",
    text: "From now on: polite nudge 3 days after the due date, a firm reminder at 10 days, and give repeat clients one extra week.",
  },
] as const;

export function EmptyChat({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed text-ink">
        Tell me about a job in plain words and I'll draft the invoice. I never send anything to a client until you
        approve it.
      </p>
      <p className="text-xs text-muted">Try one of these</p>
      <ul className="border-t border-line">
        {EXAMPLES.map((example) => (
          <li key={example.label} className="border-b border-line">
            <button
              type="button"
              onClick={() => onPick(example.text)}
              className="w-full rounded py-2.5 text-left hover:bg-paper-deep"
            >
              <span className="block text-sm font-medium text-ink">{example.label}</span>
              <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted">{example.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
