/**
 * REGISTRO DEL SERVIDOR (preproducción). Único punto que escribe en la consola del proceso; sin servicios externos todavía (el host
 * recoge stdout). Una línea JSON por evento: `{ ts, level, event, …campos }`.
 *
 * REDACCIÓN — nunca deben llegar a los registros: secretos de Clerk/Stripe/S3, tokens de invitación completos, correos, teléfonos,
 * mensajes y respuestas de RSVP, cabeceras de autorización, cuerpos de webhook. Se aplica en DOS capas:
 *  1. por NOMBRE de campo (`token`, `secret`, `email`, `message`, `answers`…): el valor se sustituye por `[redactado]`;
 *  2. por FORMA del valor (claves `sk_…`, `whsec_…`, URLs con credenciales, correos, tokens de invitación de 32+ caracteres…) aunque
 *     el campo tenga un nombre inocente.
 * Los errores se registran como `{ name, code, type }` (sin `message`, que puede traer bucket, claves o consultas).
 */
export type LogLevel = "info" | "warn" | "error";
const ORDER: Record<LogLevel, number> = { info: 0, warn: 1, error: 2 };

export const REDACTED = "[redactado]";

/** Nombres de campo cuyo valor nunca se registra (comparación por fragmento, sin distinguir mayúsculas). */
const SENSITIVE_KEYS = /token|secret|password|passwd|authorization|cookie|signature|api[-_]?key|private|credential|e-?mail|phone|tel[eé]fono|message|mensaje|answers?|respuestas?|dietary|payload|rawbody|body|guest=/i;

const VALUE_PATTERNS: Array<[RegExp, string]> = [
  [/\b(sk|rk|pk)_(test|live)_[A-Za-z0-9]{6,}/g, "[clave]"],
  [/\bwhsec_[A-Za-z0-9]{6,}/g, "[clave]"],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [redactado]"],
  [/\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@[^\s]+/gi, "[url con credenciales]"],
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[correo]"],
  // Token de invitación (base64url de 32+ caracteres) o parámetro `guest=`.
  [/guest=[A-Za-z0-9_-]{8,}/g, "guest=[redactado]"],
  [/\b[A-Za-z0-9_-]{32,}\b/g, "[token]"],
];

/** Sustituye por marcadores lo que tiene forma de secreto dentro de un texto. */
export function redactString(input: string): string {
  return VALUE_PATTERNS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), input);
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

export interface LogSink {
  info(line: string): void;
  warn(line: string): void;
  error(line: string): void;
}

const consoleSink: LogSink = {
  info: (line) => console.info(line),
  warn: (line) => console.warn(line),
  error: (line) => console.error(line),
};

let sink: LogSink = consoleSink;
/** Solo para pruebas: sustituye el destino. Devuelve una función que lo restaura. */
export function setLogSink(next: LogSink): () => void {
  const previous = sink;
  sink = next;
  return () => {
    sink = previous;
  };
}

function minimumLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL?.toLowerCase();
  return configured === "warn" || configured === "error" || configured === "info" ? configured : process.env.NODE_ENV === "test" ? "error" : "info";
}

function write(level: LogLevel, event: string, fields?: Record<string, unknown>): void {
  if (ORDER[level] < ORDER[minimumLevel()]) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event: redactString(event).slice(0, 80), ...((redact(fields ?? {}) as Record<string, unknown>) ?? {}) });
  sink[level](line);
}

export const logger = {
  info: (event: string, fields?: Record<string, unknown>) => write("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write("warn", event, fields),
  /** `error` (opcional) se reduce a `{ name, code, type }`. */
  error: (event: string, error?: unknown, fields?: Record<string, unknown>) => write("error", event, { ...(error === undefined ? {} : { error: describeError(error) }), ...fields }),
};
