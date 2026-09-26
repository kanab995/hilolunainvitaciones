import type { Prisma } from "@prisma/client";
import { DEMO_EVENT_ALIAS } from "@/lib/dashboard/demo-alias";
import { getServerNow } from "@/lib/invitation/server-time";
import { isDemoAliasEnabled } from "@/server/auth/mode";
import { getDataSource } from "@/server/data-source";
import { prisma } from "@/server/db/client";
import { dbEventToSummary } from "@/server/mappers/event";
import { getDemoRows } from "@/server/repositories/demo-store";
import { DEMO_EVENT_SLUG } from "@/server/seed/demo-data";
import type { EventSummary } from "@/types/event";
import { toPublicationInfo } from "@/lib/publishing/state";
import type { PublicationInfo } from "@/types/published";

/**
 * EVENTOS PRIVADOS. Toda función de este módulo recibe el `userId` del propietario y lo aplica en la
 * consulta (`ownerId`): no existe aquí ninguna lectura de un evento por id sin comprobar propiedad
 * (CLAUDE.md). Un evento ajeno es indistinguible de uno inexistente: devuelve `undefined`.
 * `ref` puede ser el id, el slug o —solo fuera de producción— el alias `demo`.
 */
function refFilter(ref: string): Prisma.EventWhereInput {
  const slug = ref === DEMO_EVENT_ALIAS ? (isDemoAliasEnabled() ? DEMO_EVENT_SLUG : undefined) : ref;
  return { OR: slug === undefined ? [{ id: ref }] : [{ id: ref }, { slug }] };
}

export async function getOwnedEventByRef(userId: string, ref: string): Promise<EventSummary | undefined> {
  if (getDataSource() === "demo") {
    const { event, ownerId } = getDemoRows(new Date(getServerNow()));
    const slug = ref === DEMO_EVENT_ALIAS && isDemoAliasEnabled() ? DEMO_EVENT_SLUG : ref;
    return ownerId === userId && (event.id === ref || event.slug === slug) ? dbEventToSummary(event) : undefined;
  }
  const row = await prisma.event.findFirst({ where: { ownerId: userId, ...refFilter(ref) } });
  return row ? dbEventToSummary(row) : undefined;
}

export const getOwnedEventById = async (userId: string, id: string): Promise<EventSummary | undefined> => {
  const event = await getOwnedEventByRef(userId, id);
  return event?.id === id ? event : undefined;
};

/** Fila de "Mis eventos". */
export interface OwnedEventListItem extends EventSummary {
  templateName: string;
  invitationStatus: "draft" | "published" | "unpublished";
  /** Estado de publicación (D-29) y slug público, para el estado y el botón contextual de cada tarjeta. */
  publication: PublicationInfo;
  publicSlug: string;
}

const invitationStatusFromDb = { DRAFT: "draft", PUBLISHED: "published", UNPUBLISHED: "unpublished" } as const;

/** Los eventos del usuario (y solo esos), del más próximo al más lejano. */
export async function listOwnedEvents(userId: string): Promise<OwnedEventListItem[]> {
  if (getDataSource() === "demo") {
    const { event, ownerId, invitationStatus } = getDemoRows(new Date(getServerNow()));
    return ownerId === userId
      ? [{ ...dbEventToSummary(event), templateName: "Magnolia", invitationStatus: invitationStatusFromDb[invitationStatus], publication: { state: invitationStatus === "PUBLISHED" ? "published" : "draft", version: 0 }, publicSlug: getDemoRows(new Date(getServerNow())).invitation.slug }]
      : [];
  }
  const rows = await prisma.event.findMany({
    where: { ownerId: userId },
    orderBy: { startsAt: "asc" },
    include: {
      invitation: {
        select: { slug: true, status: true, draftRevision: true, publishedRevision: true, publishedVersion: true, publishedAt: true, lastPublishedAt: true, template: { select: { name: true } } },
      },
    },
  });
  return rows.map((row) => ({
    ...dbEventToSummary(row),
    templateName: row.invitation?.template.name ?? "—",
    invitationStatus: invitationStatusFromDb[row.invitation?.status ?? "DRAFT"],
    publication: row.invitation ? toPublicationInfo(row.invitation) : { state: "draft", version: 0 },
    publicSlug: row.invitation?.slug ?? row.slug,
  }));
}
