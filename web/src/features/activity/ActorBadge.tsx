import { Bot, Landmark, Server, User } from "lucide-react";
import { Pill } from "../../components/Pill";
import type { PillTone } from "../../components/Pill";
import type { Actor } from "../../lib/types";

const ACTORS: Record<Actor, { label: string; tone: PillTone; Icon: typeof Bot }> = {
  agent: { label: "Agent", tone: "green", Icon: Bot },
  user: { label: "You", tone: "outline", Icon: User },
  paypal: { label: "PayPal", tone: "amber", Icon: Landmark },
  system: { label: "System", tone: "neutral", Icon: Server },
};

export function ActorBadge({ actor }: { actor: Actor }) {
  const { label, tone, Icon } = ACTORS[actor] ?? ACTORS.system;
  return (
    <Pill tone={tone} icon={<Icon className="size-3" aria-hidden="true" />}>
      {label}
    </Pill>
  );
}
