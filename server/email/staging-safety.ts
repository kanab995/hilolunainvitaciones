import { isStagingEnv } from "@/server/config/app-env";
import { parseStagingAllowlist, type EmailEnv } from "@/server/email/config";

/**
 * SEGURIDAD DE STAGING (D-36, encargo puntos 27-28): `APP_ENV=staging` nunca debe poder mandar un correo a una persona real
 * arbitraria (staging usa datos y cuentas de prueba, pero cualquiera puede registrarse con su correo real). Dos mecanismos:
 *  - `EMAIL_STAGING_ALLOWLIST` (correos separados por comas): fuera de esa lista, el correo NO se envía (se marca `SKIPPED`).
 *    Sin lista configurada en staging, NADA se envía (fail-closed: una lista vacía no es «permitir a todos»).
 *  - Todo asunto que sí se envía lleva el prefijo `[STAGING] `. En producción nunca se añade.
 */
export function isRecipientAllowedInStaging(env: EmailEnv, recipientEmail: string): boolean {
  if (!isStagingEnv(env)) return true;
  const allowlist = parseStagingAllowlist(env);
  return allowlist.includes(recipientEmail.trim().toLowerCase());
}

export function withStagingSubjectPrefix(env: EmailEnv, subject: string): string {
  return isStagingEnv(env) ? `[STAGING] ${subject}` : subject;
}
