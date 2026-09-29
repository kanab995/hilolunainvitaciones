import { getServerNow } from "@/lib/invitation/server-time";
import { getDataSource } from "@/server/data-source";
import { prisma } from "@/server/db/client";
import { StoreUnavailableError, uniqueViolationFields } from "@/server/db/errors";
import { dbInvitationToDomain } from "@/server/mappers/invitation";
import { getDemoRows } from "@/server/repositories/demo-store";
import { writeGuestResponse } from "@/server/repositories/guest-response";
import { publicMediaOptions } from "@/server/repositories/invitations";
import { isExpiredRecord, loadPublishedInvitation, type ExpiredRecord } from "@/server/repositories/publishing";
import { INVITE_TOKEN_PATTERN } from "@/server/services/invite-token";
import type { RsvpSaveResult, RsvpTarget, RsvpTargetQuestion, RsvpValue } from "@/server/services/public-rsvp";
import type { Invitation } from "@/types/invitation";
import type { InvitationTemplate } from "@/types/invitation-template";
import type { PublicCurrentRsvp } from "@/types/public-rsvp";

/**
 * INVITACIÓN PÚBLICA + INVITADO (`/i/<slug>?guest=<token>`). REGLA DE COINCIDENCIA (docs/ARCHITECTURE.md D-26):
 *
 *   Invitation.slug  +  Guest.inviteToken  +  Guest.eventId === Invitation.eventId
 *
 * El invitado se busca por `inviteToken` Y por el `eventId` de la invitación del slug, en la misma
 * consulta: un token de otro evento no encuentra nada, y esa situación es indistinguible de un token
 * inventado o mal formado (`tokenStatus = "invalid"`): nunca se revela que el token existe en otro evento.
 * Solo invitaciones PUBLICADAS. Este módulo devuelve datos INTERNOS (ids incluidos); el servicio
 * `toPersonalization` los reduce al contexto público que sí llega al navegador.
 */
export interface InternalGuest {
  id: string;
  name: string;
  groupName: string | null;
  maxCompanions: number;
  current: PublicCurrentRsvp | undefined;
}

export interface PublicInvitationRecord {
  invitation: Invitation;
  /** Tema con el que se PUBLICÓ (snapshot, D-29). `undefined` en la demostración y en datos anteriores: se usa el registro. */
  template?: InvitationTemplate;
  eventId: string;
  /** `none`: la URL no trae `guest`. `invalid`: trae un valor que no identifica a nadie de ESTA invitación. */
  tokenStatus: "none" | "valid" | "invalid";
  guest?: InternalGuest;
  questions: RsvpTargetQuestion[];
}

const guestSelect = {
  id: true,
  name: true,
  maxCompanions: true,
  status: true,
  group: { select: { name: true } },
  rsvp: { select: { status: true, attendeeCount: true, message: true, answers: { select: { questionId: true, value: true } } } },
} as const;

type GuestRow = {
  id: string;
  name: string;
  maxCompanions: number;
  status: "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE";
  group: { name: string } | null;
  rsvp: { status: "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE"; attendeeCount: number | null; message: string | null; answers: { questionId: string; value: string }[] } | null;
};

/** La respuesta vigente que ve la persona: la de `Rsvp` o, si el anfitrión marcó su estado a mano, solo el estado. */
function currentResponse(row: GuestRow): PublicCurrentRsvp | undefined {
  const status = row.rsvp?.status ?? row.status;
  if (status === "PENDING") return undefined;
  return {
    status,
    attendeeCount: row.rsvp?.attendeeCount ?? null,
    message: row.rsvp?.message ?? null,
    answers: Object.fromEntries((row.rsvp?.answers ?? []).map((answer) => [answer.questionId, answer.value])),
  };
}

const toInternalGuest = (row: GuestRow): InternalGuest => ({ id: row.id, name: row.name, groupName: row.group?.name ?? null, maxCompanions: row.maxCompanions, current: currentResponse(row) });

/** `ExpiredRecord` = el acceso pagado del evento terminó: sin contenido ni invitado (ni siquiera se consulta el token). */
export async function getPublicInvitationRecord(slug: string, guestToken?: string): Promise<PublicInvitationRecord | ExpiredRecord | undefined> {
  const wantsGuest = guestToken !== undefined && guestToken !== "";

  if (getDataSource() === "demo") {
    const { invitation, invitationStatus, event, guestRecords } = getDemoRows(new Date(getServerNow()));
    if (invitation.slug !== slug || invitationStatus !== "PUBLISHED") return undefined;
    const domain = dbInvitationToDomain(invitation, publicMediaOptions);
    const record = wantsGuest && INVITE_TOKEN_PATTERN.test(guestToken) ? guestRecords.find((guest) => guest.inviteToken === guestToken) : undefined;
    if (!wantsGuest) return { invitation: domain, eventId: event.id, tokenStatus: "none", questions: [] };
    if (!record) return { invitation: domain, eventId: event.id, tokenStatus: "invalid", questions: [] };
    const guest = toInternalGuest({
      id: record.id,
      name: record.name,
      maxCompanions: record.maxCompanions,
      status: record.status,
      group: record.groupName ? { name: record.groupName } : null,
      rsvp: record.status === "PENDING" ? null : { status: record.status, attendeeCount: record.attendeeCount, message: null, answers: [] },
    });
    return { invitation: domain, eventId: event.id, tokenStatus: "valid", guest, questions: [] };
  }

  // El CONTENIDO sale del snapshot publicado (nunca del borrador mutable); el invitado y su RSVP salen de la BD VIVA.
  const published = await loadPublishedInvitation(slug);
  if (!published) return undefined;
  if (isExpiredRecord(published)) return published;
  const { invitation, eventId, template } = published;
  if (!wantsGuest) return { invitation, template, eventId, tokenStatus: "none", questions: [] };
  // Un valor mal formado ni siquiera se consulta: se trata como cualquier otro token inválido.
  if (!INVITE_TOKEN_PATTERN.test(guestToken)) return { invitation, template, eventId, tokenStatus: "invalid", questions: [] };

  // Coincidencia: token + evento de la invitación, en la MISMA consulta.
  const guest = await prisma.guest.findFirst({ where: { inviteToken: guestToken, eventId }, select: guestSelect });
  if (!guest) return { invitation, template, eventId, tokenStatus: "invalid", questions: [] };

  const questions = await prisma.rsvpQuestion.findMany({ where: { eventId }, orderBy: { position: "asc" }, select: { id: true, label: true, type: true, required: true, options: true } });
  return { invitation, template, eventId, tokenStatus: "valid", guest: toInternalGuest(guest), questions };
}

/** Objetivo de una respuesta: solo si el token identifica a un invitado de ESA invitación publicada. `"expired"` = el evento ya no está disponible (no se acepta RSVP). */
export async function resolveRsvpTarget(slug: string, token: string): Promise<RsvpTarget | "expired" | null> {
  const record = await getPublicInvitationRecord(slug, token);
  if (record && isExpiredRecord(record)) return "expired";
  if (!record || record.tokenStatus !== "valid" || !record.guest) return null;
  return { eventId: record.eventId, guestId: record.guest.id, maxCompanions: record.guest.maxCompanions, rsvp: record.invitation.rsvp, questions: record.questions };
}

/**
 * Guarda la respuesta en UNA transacción: el invitado sigue siendo del evento, se crea o actualiza su única
 * `Rsvp` (upsert por `guestId`, restricción única: sin duplicados aunque lleguen dos peticiones a la vez) y
 * `Guest.status` se actualiza con ella (escritor único). Las respuestas a preguntas se reemplazan.
 * `ok: false` si el invitado ya no existe en ese evento. `changed` (D-36): el estado o el número de asistentes son
 * distintos de lo que había ANTES de este guardado (se lee dentro de la MISMA transacción); solo entonces se avisa
 * al anfitrión — volver a enviar exactamente la misma respuesta no genera un correo nuevo.
 */
export async function savePublicRsvp(target: RsvpTarget, value: RsvpValue, submittedAt: Date): Promise<RsvpSaveResult> {
  if (getDataSource() === "demo") throw new StoreUnavailableError();

  const run = (): Promise<RsvpSaveResult> =>
    prisma.$transaction(async (tx) => {
      if (!(await tx.guest.findFirst({ where: { id: target.guestId, eventId: target.eventId }, select: { id: true } })))
        return { ok: false, changed: false };
      const previous = await tx.rsvp.findUnique({ where: { guestId: target.guestId }, select: { status: true, attendeeCount: true } });
      const { rsvpId } = await writeGuestResponse(tx, {
        eventId: target.eventId,
        guestId: target.guestId,
        status: value.status,
        response: { attendeeCount: value.attendeeCount, message: value.message, submittedAt },
      });
      if (!rsvpId) return { ok: false, changed: false };

      const answered = value.answers.map((answer) => answer.questionId);
      await tx.rsvpAnswer.deleteMany({ where: { rsvpId, ...(answered.length > 0 ? { questionId: { notIn: answered } } : {}) } });
      for (const answer of value.answers) {
        await tx.rsvpAnswer.upsert({ where: { rsvpId_questionId: { rsvpId, questionId: answer.questionId } }, create: { rsvpId, questionId: answer.questionId, value: answer.value }, update: { value: answer.value } });
      }
      const changed = !previous || previous.status !== value.status || previous.attendeeCount !== value.attendeeCount;
      return { ok: true, changed };
    });

  try {
    return await run();
  } catch (error) {
    // Dos envíos simultáneos del mismo invitado: uno pierde la carrera por la restricción única; se reintenta una vez.
    if (uniqueViolationFields(error)) return run();
    throw error;
  }
}
