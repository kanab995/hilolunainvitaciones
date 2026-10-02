"use server";

import { readGeneralRsvpFormData } from "@/server/services/general-rsvp";
import { submitGeneralRsvpDefault } from "@/server/services/general-rsvp-runtime";
import { readPublicRsvpFormData } from "@/server/services/public-rsvp";
import { submitPublicRsvpDefault } from "@/server/services/public-rsvp-runtime";
import type { GeneralRsvpResult, PublicRsvpResult } from "@/types/public-rsvp";

/**
 * SERVER ACTION pública del RSVP (sin Clerk: la persona invitada no crea cuenta ni inicia sesión). Usa el
 * mecanismo del propio Next.js (protección de origen de las Server Actions), sin endpoint aparte. Lee SOLO
 * `slug`, `guest`, `status`, `attendeeCount`, `message` y `answer:<id>`; cualquier otro campo se ignora.
 * Toda la validación y la autoridad (a quién se responde, máximo de asistentes, plazo, preguntas del
 * evento) están en el servidor: ver `server/services/public-rsvp.ts`.
 */
export async function submitPublicRsvp(_previous: PublicRsvpResult | null, formData: FormData): Promise<PublicRsvpResult> {
  return submitPublicRsvpDefault(readPublicRsvpFormData(formData));
}

/**
 * SERVER ACTION del RSVP GENERAL (D-40: enlace público sin `?guest=`, autorregistra un invitado nuevo).
 * Lee SOLO `slug`, `name`, `status`, `companions` y `dietaryNotes`. Nunca guarda nada de una demo
 * (`/i/demo-*`): ver `server/services/general-rsvp.ts`.
 */
export async function submitGeneralRsvp(_previous: GeneralRsvpResult | null, formData: FormData): Promise<GeneralRsvpResult> {
  return submitGeneralRsvpDefault(readGeneralRsvpFormData(formData));
}
