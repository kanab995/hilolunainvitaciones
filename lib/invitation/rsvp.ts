import type { RSVPSettings } from "@/types/invitation";

/**
 * Reglas de confirmación de asistencia. Lógica GENÉRICA: la usa `RSVPSection` con los
 * `RSVPSettings` de la invitación, sea cual sea la plantilla. No hay persistencia todavía.
 */

/** "Tal vez" cuenta como Pendiente en las métricas (CLAUDE.md, decisión 8). */
export type RsvpAttendance = "yes" | "no" | "maybe";

export interface RsvpInput {
  name: string;
  attendance: RsvpAttendance | "";
  companions: number;
  dietaryNotes?: string;
}

export type RsvpErrors = Partial<Record<"name" | "attendance" | "companions", string>>;

export type RsvpAvailability = "open" | "closed" | "disabled";

export function getRsvpAvailability(settings: RSVPSettings, nowMs: number): RsvpAvailability {
  if (!settings.enabled) return "disabled";
  if (settings.deadline) {
    const deadline = Date.parse(settings.deadline);
    if (!Number.isNaN(deadline) && nowMs > deadline) return "closed";
  }
  return "open";
}

export function validateRsvp(settings: RSVPSettings, input: RsvpInput): RsvpErrors {
  const errors: RsvpErrors = {};
  if (input.name.trim().length < 2) errors.name = "Escribe tu nombre.";
  if (input.attendance === "") errors.attendance = "Elige una opción.";
  else if (input.attendance === "maybe" && !settings.allowMaybe) errors.attendance = "Elige una opción.";
  if (!Number.isInteger(input.companions) || input.companions < 0 || input.companions > settings.maxCompanions) {
    errors.companions = `Puedes añadir hasta ${settings.maxCompanions} acompañantes.`;
  }
  return errors;
}
