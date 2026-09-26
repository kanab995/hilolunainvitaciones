import { getDataSource } from "@/server/data-source";
import { prisma } from "@/server/db/client";
import { StoreUnavailableError, uniqueViolationFields } from "@/server/db/errors";
import { writeEventAggregate } from "@/server/repositories/invitations";
import type { NewEventAggregate } from "@/server/services/event-aggregate";

/**
 * ACCESO A DATOS del alta de un evento (D-28). Toda la escritura ocurre en UNA transacción: el evento, su
 * invitación, sus secciones y el contenido inicial se guardan juntos o no se guarda nada. Solo con base de
 * datos (el origen de demostración es de solo lectura).
 */
export class TemplateUnavailableError extends Error {
  constructor() {
    super("La plantilla no existe, no está publicada o su diseño no está aprobado.");
    this.name = "TemplateUnavailableError";
  }
}

/** Otra petición ocupó el slug entre la comprobación y la escritura: el servicio reintenta con otro. */
export class SlugTakenError extends Error {
  constructor(readonly fields: readonly string[]) {
    super("slug ocupado");
    this.name = "SlugTakenError";
  }
}

const requireDatabase = () => {
  if (getDataSource() === "demo") throw new StoreUnavailableError();
};

/** Slugs ya ocupados que empiezan por las bases dadas (para elegir un sufijo libre). */
export async function findTakenSlugs(bases: { event: string; invitation: string }): Promise<{ event: Set<string>; invitation: Set<string> }> {
  requireDatabase();
  const [events, invitations] = await Promise.all([
    prisma.event.findMany({ where: { slug: { startsWith: bases.event } }, select: { slug: true } }),
    prisma.invitation.findMany({ where: { slug: { startsWith: bases.invitation } }, select: { slug: true } }),
  ]);
  return { event: new Set(events.map((row) => row.slug)), invitation: new Set(invitations.map((row) => row.slug)) };
}

/**
 * Crea el evento del usuario. La plantilla se vuelve a comprobar DENTRO de la transacción (publicada y con
 * diseño aprobado) y el tipo de evento debe ser el suyo; el propietario es `ownerId` (sale de la sesión).
 */
export async function createOwnedEvent(ownerId: string, aggregate: NewEventAggregate): Promise<{ eventId: string; invitationId: string }> {
  requireDatabase();
  try {
    return await prisma.$transaction(async (tx) => {
      const template = await tx.template.findFirst({
        where: { slug: aggregate.templateSlug, publicationStatus: "PUBLISHED", designStatus: "IMPLEMENTED", eventType: aggregate.event.type },
        select: { id: true },
      });
      if (!template) throw new TemplateUnavailableError();
      const owner = await tx.user.findUnique({ where: { id: ownerId }, select: { id: true } });
      if (!owner) throw new Error("El usuario propietario no existe.");
      return writeEventAggregate(tx, aggregate, template.id, owner.id);
    });
  } catch (error) {
    const fields = uniqueViolationFields(error);
    if (fields && fields.some((field) => field.includes("slug"))) throw new SlugTakenError(fields);
    throw error;
  }
}
