/**
 * REDACCIÓN — funciones PURAS compartidas por el registro (`logger.ts`) y el monitoreo de errores (`monitoring.ts`, D-37). Viven
 * aparte para que ambos puedan usarlas sin un import circular (`logger` llama a `monitoring` para reenviar errores a Sentry).
 *
 * Nunca deben llegar a un registro ni a un evento de monitoreo: secretos de Clerk/Stripe/S3/Resend, tokens de invitación completos,
 * correos, teléfonos, mensajes y respuestas de RSVP, cabeceras de autorización, cuerpos de webhook. Se aplica en DOS capas:
 *  1. por NOMBRE de campo (`token`, `secret`, `email`, `message`, `answers`…): el valor se sustituye por `[redactado]`;
 *  2. por FORMA del valor (claves `sk_…`, `whsec_…`, `re_…`, URLs con credenciales, correos, tokens de invitación de 32+ caracteres…)
 *     aunque el campo tenga un nombre inocente.
 */
export const REDACTED = "[redactado]";

/** Nombres de campo cuyo valor nunca se registra (comparación por fragmento, sin distinguir mayúsculas). */
export const SENSITIVE_KEYS = /token|secret|password|passwd|authorization|cookie|signature|api[-_]?key|private|credential|e-?mail|phone|tel[eé]fono|message|mensaje|answers?|respuestas?|dietary|payload|rawbody|body|guest=/i;

/** `MAYUSCULAS_CON_GUION_BAJO`: la forma convencional de un NOMBRE de variable de entorno (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`), nunca la de
 *  un secreto o token real (que mezcla mayúsculas/minúsculas o es aleatorio). Se usa para NO enmascarar nombres de variables que aparecen
 *  en un mensaje de aviso (p. ej. «Producción usa una clave de prueba: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY»): sin esta excepción, el propio
 *  nombre de la variable —justo lo que hace falta para saber qué corregir— quedaba sustituido por «[token]» al pasar por este filtro. */
const isEnvVariableName = (value: string): boolean => /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(value);

export const VALUE_PATTERNS: Array<[RegExp, string | ((match: string) => string)]> = [
  [/\b(sk|rk|pk)_(test|live)_[A-Za-z0-9]{6,}/g, "[clave]"],
  [/\bwhsec_[A-Za-z0-9]{6,}/g, "[clave]"],
  // Clave de Resend: `re_` + 6+ caracteres (sin distinción test/live).
  [/\bre_[A-Za-z0-9]{6,}/g, "[clave]"],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [redactado]"],
  [/\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@[^\s]+/gi, "[url con credenciales]"],
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[correo]"],
  // Token de invitación (base64url de 32+ caracteres) o parámetro `guest=`.
  [/guest=[A-Za-z0-9_-]{8,}/g, "guest=[redactado]"],
  [/\b[A-Za-z0-9_-]{32,}\b/g, (match) => (isEnvVariableName(match) ? match : "[token]")],
];

/** Sustituye por marcadores lo que tiene forma de secreto dentro de un texto. */
export function redactString(input: string): string {
  return VALUE_PATTERNS.reduce((text, [pattern, replacement]) => (typeof replacement === "function" ? text.replace(pattern, replacement) : text.replace(pattern, replacement)), input);
}

/** Copia profunda y acotada con redacción por nombre y por forma. Nunca lanza. */
export function redact(input: unknown, depth = 0): unknown {
  if (input === null || input === undefined) return input;
  if (typeof input === "string") return redactString(input).slice(0, 500);
  if (typeof input === "number" || typeof input === "boolean") return input;
  if (input instanceof Date) return input.toISOString();
  if (depth >= 4) return "[…]";
  if (Array.isArray(input)) return input.slice(0, 20).map((item) => redact(item, depth + 1));
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>).slice(0, 40)) out[key] = SENSITIVE_KEYS.test(key) ? REDACTED : redact(value, depth + 1);
    return out;
  }
  return "[no serializable]";
}

/** Un error, reducido a etiquetas técnicas mínimas (sin `message` ni pila). */
export function describeError(error: unknown): { name: string; code?: string; type?: string } {
  if (typeof error !== "object" || error === null) return { name: "desconocido" };
  const record = error as Record<string, unknown>;
  const label = (key: string) => (typeof record[key] === "string" ? redactString(String(record[key])).slice(0, 60) : undefined);
  const code = label("code");
  const type = label("type");
  return { name: error instanceof Error ? error.name : "desconocido", ...(code ? { code } : {}), ...(type ? { type } : {}) };
}
