import { isValidTimeZone } from "@/lib/events/create-event-input";
import type { Invitation } from "@/types/invitation";

/**
 * MÍNIMO PARA PUBLICAR (D-29). Solo lo crítico: nombre(s), fecha válida y plantilla válida. NO se exige contenido
 * opcional (galería, mesa de regalos, sedes, música…): las secciones sin contenido simplemente no se dibujan en la
 * invitación pública. Las reglas de longitud y formato de cada campo son las del editor
 * (`lib/editor/validation.ts`) y ya se aplican al guardar el borrador: aquí no se duplican.
 */
export interface PublishIssue {
  field: "names" | "event" | "template";
  message: string;
}

export function validatePublishable(invitation: Pick<Invitation, "names" | "event">, templateOk: boolean): PublishIssue[] {
  const issues: PublishIssue[] = [];
  if (invitation.names.every((name) => name.trim().length === 0)) issues.push({ field: "names", message: "Escribe al menos un nombre en la portada." });
  if (Number.isNaN(Date.parse(invitation.event.startsAt)) || !isValidTimeZone(invitation.event.timezone)) issues.push({ field: "event", message: "Elige una fecha y hora válidas para el evento." });
  if (!templateOk) issues.push({ field: "template", message: "La plantilla de esta invitación ya no está disponible. Elige otra." });
  return issues;
}
