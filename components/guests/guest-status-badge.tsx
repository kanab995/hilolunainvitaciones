import { Badge } from "@/components/ui/badge";
import { statusLabels } from "@/lib/guests/copy";
import type { GuestStatusGroup } from "@/types/guests";

const tones = { confirmed: "success", pending: "pending", declined: "declined" } as const;

/** Estado del invitado: siempre con texto (nunca solo color), con los tokens success / pending / declined. */
export function GuestStatusBadge({ status }: { status: GuestStatusGroup }) {
  return (
    <Badge tone={tones[status]} dot>
      {statusLabels[status]}
    </Badge>
  );
}
