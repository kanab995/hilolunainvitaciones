import { createHash, randomBytes } from "node:crypto";

/**
 * TOKEN DE INVITACIÓN (`Guest.inviteToken`): identificador PÚBLICO y opaco del enlace personalizado
 * `/i/<slug>?guest=<token>`. Nunca se usa `Guest.id` en una URL pública.
 *  - Aleatorio criptográfico (`crypto.randomBytes`, 24 bytes = 192 bits), en base64url (32 caracteres).
 *  - Sin relación con el id ni con los datos del invitado; único por restricción de la base de datos.
 *  - Estable: no se regenera (los enlaces ya enviados no deben romperse).
 * Solo servidor.
 */
export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;

export function generateInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Token DETERMINISTA solo para los datos de demostración (seed y origen en memoria): el seed puede
 * repetirse sin cambiar los enlaces del demo. Es un hash del id con una sal fija, no el id.
 */
export function deriveDemoInviteToken(guestId: string): string {
  return createHash("sha256").update(`hiloluna-demo-invite:${guestId}`).digest("base64url").slice(0, 32);
}
