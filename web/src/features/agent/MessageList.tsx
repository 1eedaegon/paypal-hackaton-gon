import { useEffect, useRef } from "react";
import type { ChatEntry } from "./chatStorage";
import { EffectCards } from "./EffectCards";
import { RichText } from "./richText";

const THINKING_LABEL = { chat: "Duely is thinking…", review: "Reviewing every unpaid invoice against your policy…" };

function Message({ entry }: { entry: ChatEntry }) {
  const isUser = entry.role === "user";
  return (
    <li>
      <p className="text-xs text-muted">{isUser ? "You" : "Duely"}</p>
      <div className="mt-0.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-ink">
        {isUser ? entry.content : <RichText text={entry.content} />}
      </div>
      {isUser ? null : <EffectCards effects={entry.effects} />}
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
        <li role="status" className="text-sm text-muted">
          {THINKING_LABEL[pending]}
        </li>
      ) : null}
      <li ref={endRef} aria-hidden="true" />
    </ol>
  );
}
