import { Bot } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ChatEntry } from "./chatStorage";
import { EffectCards } from "./EffectCards";
import { RichText } from "./richText";

const THINKING_LABEL = { chat: "Duely is thinking…", review: "Reviewing every unpaid invoice against your policy…" };

function Message({ entry }: { entry: ChatEntry }) {
  if (entry.role === "user") {
    return (
      <li className="flex justify-end">
        <p className="max-w-[88%] rounded-2xl rounded-br-md bg-ink px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap text-paper">
          <span className="sr-only">You: </span>
          {entry.content}
        </p>
      </li>
    );
  }
  return (
    <li className="animate-rise">
      <div className="text-sm leading-relaxed break-words whitespace-pre-wrap text-ink">
        <span className="sr-only">Duely: </span>
        <RichText text={entry.content} />
      </div>
      <EffectCards effects={entry.effects} />
    </li>
  );
}

interface MessageListProps {
  entries: readonly ChatEntry[];
  pending: "chat" | "review" | null;
}

export function MessageList({ entries, pending }: MessageListProps) {
  const endRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const scroller = endRef.current?.closest("[data-chat-scroll]");
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [entries.length, pending]);

  return (
    <ol className="flex flex-col gap-4" aria-live="polite">
      {entries.map((entry) => (
        <Message key={entry.id} entry={entry} />
      ))}
      {pending ? (
        <li role="status" className="flex items-center gap-2 text-sm text-muted">
          <Bot className="size-4 animate-pulse" aria-hidden="true" />
          {THINKING_LABEL[pending]}
        </li>
      ) : null}
      <li ref={endRef} aria-hidden="true" />
    </ol>
  );
}
