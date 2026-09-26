import { Check, ChartColumn, Clock, Pencil, Users, X } from "lucide-react";
import Image from "next/image";
import { MiniInvitationCard } from "@/components/dashboard/mini-invitation-card";
import { describeRsvpSummary, RsvpDonut } from "@/components/dashboard/rsvp-donut";
import { ShareActionCard } from "@/components/dashboard/share-action-card";
import { ShortcutCard } from "@/components/dashboard/shortcut-card";
import { Avatar } from "@/components/ui/avatar";
import { dashboardAssets } from "@/lib/dashboard/assets";
import { dashboardCopy } from "@/lib/dashboard/copy";
import { formatEventDate } from "@/lib/dashboard/format";
import { routes } from "@/lib/routes";
import { displayNames } from "@/lib/invitation/format";
import { cn } from "@/lib/utils";
import type { EventDashboardData, GuestPreviewStatus } from "@/types/dashboard";

const guestStatusIcon: Record<GuestPreviewStatus, { icon: typeof Check; circle: string }> = {
  confirmed: { icon: Check, circle: "bg-lu-success text-lu-on-ink" },
  pending: { icon: Clock, circle: "bg-lu-pending-bg text-lu-text" },
  declined: { icon: X, circle: "bg-lu-declined-bg text-lu-text" },
};

/**
 * Las cuatro tarjetas de acción (mockup 05): Editar invitación · Invitados · Confirmaciones ·
 * Compartir. Cada una con ícono, título, descripción, flecha y una vista previa inferior hecha con
 * assets aprobados o formas propias (iniciales en lugar de fotografías).
 */
export function ActionCards({ data }: { data: EventDashboardData }) {
  const { event, invitation, rsvpSummary, guestPreview } = data;
  const copy = dashboardCopy.actions;
  const cover = dashboardAssets.coverBackdrop;
  const dateLabel = formatEventDate(event.startsAt, event.timezone).toUpperCase().split(" ").join(" · ");

  return (
    <section aria-label="Acciones del evento" className="@container">
      <ul className="grid gap-4 @[36rem]:grid-cols-2 @[64rem]:grid-cols-4">
        <li>
          <ShortcutCard icon={<Pencil />} title={copy.edit.title} description={copy.edit.description} href={routes.eventEdit(event.id)}>
            <div className="relative h-28 overflow-hidden rounded-lu-image bg-lu-surface-tint">
              <Image src={cover.src} alt="" width={cover.width} height={cover.height} sizes="(min-width: 1280px) 260px, (min-width: 640px) 45vw, 90vw" className="absolute inset-0 size-full object-cover object-[50%_30%]" />
              <MiniInvitationCard
                size="sm"
                eyebrow={invitation.cover.eyebrow}
                names={displayNames(invitation.names)}
                dateLabel={dateLabel}
                className="absolute top-3 left-1/2 -translate-x-1/2"
              />
            </div>
          </ShortcutCard>
        </li>

        <li>
          <ShortcutCard icon={<Users />} title={copy.guests.title} description={copy.guests.description} href={routes.eventGuests(event.id)}>
            <ul aria-label="Vista previa de invitados" className="flex flex-col divide-y divide-lu-border-subtle rounded-lu-image border border-lu-border-subtle bg-lu-surface px-3">
              {guestPreview.map((guest) => {
                const { icon: Icon, circle } = guestStatusIcon[guest.status];
                return (
                  <li key={guest.id} className="flex items-center gap-2.5 py-2">
                    <Avatar name={guest.name} size="sm" className="size-7" />
                    <span className="min-w-0 flex-1 truncate font-lu-display text-lu-base text-lu-text">{guest.name}</span>
                    <span className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full", circle)}>
                      <Icon aria-hidden="true" className="size-3" strokeWidth={2} />
                      <span className="sr-only">{dashboardCopy.guestStatus[guest.status]}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </ShortcutCard>
        </li>

        <li>
          <ShortcutCard icon={<ChartColumn />} title={copy.rsvp.title} description={copy.rsvp.description} href={routes.eventRsvp(event.id)}>
            <div className="flex items-center gap-4 rounded-lu-image bg-lu-surface-tint/70 px-4 py-3">
              <RsvpDonut summary={rsvpSummary} size={76} />
              <div className="flex flex-col">
                <span className="font-lu-display text-lu-title-lg leading-none text-lu-text">{rsvpSummary.confirmed}</span>
                <span className="text-lu-sm text-lu-text-secondary">Confirmados</span>
                {/* Equivalente textual completo del gráfico */}
                <span className="sr-only">{describeRsvpSummary(rsvpSummary)}</span>
              </div>
            </div>
          </ShortcutCard>
        </li>

        <li>
          <ShareActionCard slug={event.publicSlug} />
        </li>
      </ul>
    </section>
  );
}
