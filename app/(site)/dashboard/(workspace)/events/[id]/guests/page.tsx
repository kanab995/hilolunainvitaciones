import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardPlaceholder } from "@/components/dashboard/dashboard-placeholder";
import { GuestManager } from "@/components/guests/guest-manager";
import { GuestSummary } from "@/components/guests/guest-summary";
import { guestsCopy } from "@/lib/guests/copy";
import { filterGuests, parseGuestFilters, summarizeGuests } from "@/lib/guests/filter";
import { limitOf } from "@/lib/billing/entitlements";
import { routes } from "@/lib/routes";
import { requireOwnedEvent } from "@/server/auth/ownership";
import { guestRecordToRow } from "@/server/mappers/guest";
import { listOwnedGuestGroups, listOwnedGuests } from "@/server/repositories/guests";
import { getOwnedDraftMeta } from "@/server/repositories/publishing";
import { getEventEntitlements } from "@/server/services/entitlement-service";

export const metadata: Metadata = { title: "Invitados" };

/**
 * Guest Manager (`/dashboard/events/[id]/guests`). Sesión y PROPIEDAD del evento comprobadas en el
 * servidor antes de leer nada (un evento ajeno = `notFound()`); todas las lecturas van filtradas por el
 * propietario. Los filtros viven en la URL (`?q=&status=&group=`) y se aplican aquí; el resumen sale de
 * TODOS los invitados, no solo de los que se ven.
 */
export default async function EventGuestsPage(props: PageProps<"/dashboard/events/[id]/guests">) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const { user, event } = await requireOwnedEvent(id);
  if (event.id !== id) redirect(routes.eventGuests(event.id));

  const [records, groups, meta, entitlements] = await Promise.all([listOwnedGuests(user.id, event.id), listOwnedGuestGroups(user.id, event.id), getOwnedDraftMeta(user.id, event.id), getEventEntitlements(event.id)]);
  const all = records.map((record) => guestRecordToRow(record, meta?.slug ?? ""));
  const filters = parseGuestFilters(searchParams, groups.map((group) => group.id));
  const visible = filterGuests(all, filters);

  return (
    <DashboardPlaceholder title={guestsCopy.title} description={guestsCopy.description} eventId={event.id} eventTitle={event.title}>
      <GuestSummary summary={summarizeGuests(all)} />
      <GuestManager
        eventId={event.id}
        guests={visible}
        totalCount={all.length}
        groups={groups}
        filters={filters}
        publication={{ slug: meta?.slug ?? "", state: meta?.publication.state ?? "draft" }}
        // La cuota de invitados (D-32) solo cuenta a los que el anfitrión agregó: los autorregistrados por el
        // enlace general (D-40, `source: "PUBLIC_RSVP"`) tienen su propia cuota aparte y no cuentan aquí.
        guestLimit={{ count: all.filter((guest) => guest.source === "HOST").length, max: limitOf(entitlements, "maxGuestsPerEvent") }}
      />
    </DashboardPlaceholder>
  );
}
