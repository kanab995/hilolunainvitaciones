/**
 * CONFIGURACIÓN DE CORREO desde variables de entorno (D-36). Lógica pura sobre un objeto de entorno (se prueba sin tocar
 * `process.env`). Nunca se registran valores: los problemas nombran VARIABLES. Mismo patrón que `server/billing/stripe/config.ts`.
 *  - Sin `RESEND_API_KEY` → no configurado (no es un error: en desarrollo se usa el proveedor de desarrollo; en producción con
 *    `EMAIL_REQUIRED=true` el arranque falla, ver `server/config/env.ts`).
 *  - `EMAIL_FROM` es obligatorio junto con la clave: sin remitente no se puede enviar nada. Formato: `Nombre <correo@dominio>` o
 *    un correo simple.
 *  - `EMAIL_REPLY_TO` es opcional; si se declara, debe tener forma de correo.
 *  - `EMAIL_STAGING_ALLOWLIST` (solo relevante en staging): lista de correos separados por comas. Ver `server/email/staging-safety.ts`.
 */
export type EmailEnv = Readonly<Record<string, string | undefined>>;

export interface EmailConfig {
  apiKey: string;
  /** Cabecera `From` completa, tal cual se envía (p. ej. `Hilo Luna <notificaciones@hiloluna.com>`). */
  from: string;
  replyTo?: string;
}

export type EmailConfigResult = { status: "ready"; config: EmailConfig } | { status: "not_configured" } | { status: "invalid"; problems: string[] };

const clean = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/** `Nombre <correo@dominio>` o `correo@dominio`, sin saltos de línea (inyección de cabeceras). */
const FROM_PATTERN = /^(?:[^\r\n<>]{1,120}\s<[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+>|[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+)$/;
const EMAIL_PATTERN = /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;

export function resolveEmailConfig(env: EmailEnv = process.env): EmailConfigResult {
  const apiKey = clean(env.RESEND_API_KEY);
  if (!apiKey) return { status: "not_configured" };

  const problems: string[] = [];
  if (!apiKey.startsWith("re_")) problems.push("RESEND_API_KEY no tiene el formato de una clave de Resend (re_…).");

  const from = clean(env.EMAIL_FROM);
  if (!from) problems.push("Falta EMAIL_FROM: el remitente de los correos (p. ej. «Hilo Luna <notificaciones@hiloluna.com>»).");
  else if (!FROM_PATTERN.test(from)) problems.push("EMAIL_FROM no tiene el formato «Nombre <correo@dominio>» ni el de un correo.");

  const replyTo = clean(env.EMAIL_REPLY_TO);
  if (replyTo && !EMAIL_PATTERN.test(replyTo)) problems.push("EMAIL_REPLY_TO no tiene el formato de un correo.");

  if (problems.length > 0 || !from) return { status: "invalid", problems };
  return { status: "ready", config: { apiKey, from, ...(replyTo ? { replyTo } : {}) } };
}

/** Lista de correos permitidos en staging (`EMAIL_STAGING_ALLOWLIST`, separados por comas), ya normalizados (minúsculas, sin espacios). */
export function parseStagingAllowlist(env: EmailEnv = process.env): string[] {
  return (env.EMAIL_STAGING_ALLOWLIST ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}
