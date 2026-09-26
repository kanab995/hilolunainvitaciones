import { GUEST_LIMITS, NEW_GROUP_VALUE } from "@/lib/guests/limits";
import type { GuestField, GuestStatus } from "@/types/guests";

export { GUEST_LIMITS, NEW_GROUP_VALUE };

/**
 * VALIDACIÓN de los datos de un invitado (frontera del servidor). Sin Zod (todavía no aprobado): son
 * siete campos; si crece, se propondrá antes de instalarlo. Pura y probada. Solo lee las claves de la
 * lista blanca `GUEST_FIELDS`: cualquier otra (p. ej. `ownerId`, `eventId`, `inviteToken`) se ignora.
 */
export const GUEST_FIELDS = ["name", "email", "phone", "groupId", "newGroupName", "maxCompanions", "status"] as const satisfies readonly GuestField[];

export interface GuestInput {
  name: string;
  email: string | null;
  phone: string | null;
  maxCompanions: number;
  /** `undefined` = no cambiar (en la edición) / "Pendiente" (en el alta). */
  status: GuestStatus | undefined;
  groupId: string | null;
  newGroupName: string | null;
}

export type GuestValidation = { ok: true; value: GuestInput } | { ok: false; errors: Partial<Record<GuestField, string>> };

const STATUSES: readonly GuestStatus[] = ["PENDING", "ATTENDING", "DECLINED", "MAYBE"];
const collapse = (text: string) => text.trim().replace(/\s+/g, " ");
const asText = (value: unknown): string => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "");

/** Toma de un `FormData` solo los campos permitidos. */
export function readGuestFormData(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(GUEST_FIELDS.map((field) => [field, formData.get(field)]));
}

export function validateGuestInput(raw: Record<string, unknown>): GuestValidation {
  const errors: Partial<Record<GuestField, string>> = {};

  const name = collapse(asText(raw.name));
  if (!name) errors.name = "Escribe el nombre del invitado.";
  else if (name.length > GUEST_LIMITS.name) errors.name = `El nombre no puede superar ${GUEST_LIMITS.name} caracteres.`;

  const emailText = asText(raw.email).trim().toLowerCase();
  let email: string | null = null;
  if (emailText) {
    if (emailText.length > GUEST_LIMITS.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailText)) errors.email = "Escribe un correo válido, por ejemplo nombre@correo.com.";
    else email = emailText;
  }

  const phoneText = collapse(asText(raw.phone));
  let phone: string | null = null;
  if (phoneText) {
    const digitCount = phoneText.replace(/\D/g, "").length;
    if (!/^[0-9+()\-.\s]+$/.test(phoneText) || digitCount < GUEST_LIMITS.phoneDigits.min || digitCount > GUEST_LIMITS.phoneDigits.max) errors.phone = "Escribe un teléfono válido (de 7 a 15 dígitos).";
    else phone = phoneText;
  }

  const companionsText = asText(raw.maxCompanions).trim();
  let maxCompanions = 0;
  if (companionsText) {
    const parsed = Number(companionsText);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > GUEST_LIMITS.maxCompanions) errors.maxCompanions = `Indica un número entero de 0 a ${GUEST_LIMITS.maxCompanions}.`;
    else maxCompanions = parsed;
  }

  const statusText = asText(raw.status);
  let status: GuestStatus | undefined;
  if (statusText) {
    if (!(STATUSES as readonly string[]).includes(statusText)) errors.status = "Elige un estado válido.";
    else status = statusText as GuestStatus;
  }

  const groupText = asText(raw.groupId).trim();
  let groupId: string | null = null;
  let newGroupName: string | null = null;
  if (groupText === NEW_GROUP_VALUE) {
    const groupName = collapse(asText(raw.newGroupName));
    if (!groupName) errors.newGroupName = "Escribe el nombre del grupo.";
    else if (groupName.length > GUEST_LIMITS.groupName) errors.newGroupName = `El nombre del grupo no puede superar ${GUEST_LIMITS.groupName} caracteres.`;
    else newGroupName = groupName;
  } else if (groupText) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(groupText)) errors.groupId = "Elige un grupo válido.";
    else groupId = groupText;
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value: { name, email, phone, maxCompanions, status, groupId, newGroupName } };
}
