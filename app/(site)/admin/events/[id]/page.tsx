import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessBadge, PlanBadge, PublicationBadge } from "@/components/admin/badges";
import { AdminFacts, AdminPageHeader, AdminPanel, AdminStatList } from "@/components/admin/parts";
import { PurchaseHistoryTable } from "@/components/admin/purchase-history";
import { adminCopy } from "@/lib/admin/copy";
import { formatAdminDate, formatAdminDateTime } from "@/lib/admin/format";
import { adminEventTypeLabel } from "@/lib/admin/options";
import { routes } from "@/lib/routes";
import { getAdminEvent } from "@/server/admin/events";
import { requireAdmin } from "@/server/auth/admin";

const copy = adminCopy.events;

export const metadata: Metadata = { title: copy.detailTitle };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toLocaleString("es-MX", { maximumFractionDigits: 1 })} ${units[unit]}`;
}

/**
 * Detalle de un evento (`/admin/events/[id]`). Solo lectura y MÍNIMO NECESARIO: de los invitados solo hay conteos y el resumen de confirmaciones
 * (nada de correos, teléfonos, mensajes, respuestas ni enlaces personalizados). El plan y el acceso salen de las mismas funciones que usa el producto.
 */
export default async function AdminEventPage(props: PageProps<"/admin/events/[id]">) {
  const admin = await requireAdmin();
  const { id } = await props.params;
  const event = await getAdminEvent(admin, id);
  if (!event) notFound();

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={event.title} description={copy.detailTitle} crumbs={[{ label: copy.title, href: routes.adminEvents }]} />

      <AdminPanel id="event-summary" title={copy.summary} hint={copy.privacyNote}>
        <AdminFacts
          items={[
            {
              label: copy.owner,
              value: (
                <Link href={routes.adminUser(event.owner.id)} className="hover:underline">
                  {event.owner.name?.trim() || event.owner.email}
                </Link>
              ),
            },
            { label: copy.type, value: adminEventTypeLabel(event.type) },
            { label: copy.eventDate, value: `${formatAdminDateTime(event.startsAt)} · ${event.timezone}` },
            { label: copy.slug, value: event.invitationSlug ? <span className="break-all">/i/{event.invitationSlug}</span> : copy.noInvitation },
            { label: copy.template, value: event.template ? `${event.template.name} (${event.template.slug})` : adminCopy.common.none },
            { label: copy.publicationState, value: <PublicationBadge state={event.publication} /> },
            { label: copy.publishedVersion, value: event.publishedVersion > 0 ? event.publishedVersion : copy.neverPublished },
            { label: copy.effectivePlan, value: <PlanBadge plan={event.plan} /> },
            { label: copy.paidAccessUntil, value: event.plan === "FREE" ? adminCopy.common.none : formatAdminDate(event.paidAccessEndsAt) },
            { label: copy.access, value: <AccessBadge state={event.accessState} /> },
            { label: copy.createdAt, value: formatAdminDateTime(event.createdAt) },
            { label: copy.updatedAt, value: formatAdminDateTime(event.updatedAt) },
          ]}
        />
      </AdminPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminPanel id="event-rsvp" title={copy.rsvpSummary} hint={copy.pendingNote}>
          <AdminStatList
            items={[
              { label: copy.guests, value: event.guestCount },
              { label: copy.rsvpReceived, value: event.rsvp.received },
              { label: copy.confirmed, value: event.rsvp.confirmed },
              { label: copy.declined, value: event.rsvp.declined },
              { label: copy.pending, value: event.rsvp.pending },
            ]}
          />
        </AdminPanel>
        <AdminPanel id="event-usage" title={adminCopy.overview.mediaTitle}>
          <AdminStatList
            items={[
              { label: copy.gallery, value: event.galleryCount },
              { label: copy.media, value: event.mediaCount, note: formatBytes(event.mediaBytes) },
            ]}
          />
        </AdminPanel>
      </div>

      <AdminPanel id="event-purchases" title={copy.purchasesTitle}>
        <PurchaseHistoryTable purchases={event.purchases} caption={copy.purchasesCaption} empty={copy.noPurchases} />
      </AdminPanel>
    </div>
  );
}
