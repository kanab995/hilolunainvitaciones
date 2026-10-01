import { captureException } from "@/server/observability/monitoring";
import { describeError, redact, redactString, REDACTED, SENSITIVE_KEYS, VALUE_PATTERNS } from "@/server/observability/redact";

/**
 * REGISTRO DEL SERVIDOR (preproducción / D-37). Único punto que escribe en la consola del proceso; el host recoge stdout. Una línea
 * JSON por evento: `{ ts, level, event, …campos }`. La redacción (por nombre de campo y por forma del valor) vive en
 * `server/observability/redact.ts`; este módulo la reexporta para no romper los imports existentes.
 *
 * `logger.error` reenvía además la excepción a Sentry si está configurado (`server/observability/monitoring.ts`, D-37): un único
 * punto de llamada (nadie más importa el SDK de Sentry), así que capturar "excepciones del servidor, fallos de ruta, del webhook y
 * de subida" es automático dondequiera que ya se llamaba `logger.error(...)`. Nunca bloquea ni hace fallar al llamador.
 */
export type LogLevel = "info" | "warn" | "error";
const ORDER: Record<LogLevel, number> = { info: 0, warn: 1, error: 2 };

export { REDACTED, SENSITIVE_KEYS, VALUE_PATTERNS, redact, redactString, describeError };

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
  /** `error` (opcional) se reduce a `{ name, code, type }` en el registro; el original (con pila, saneado) puede llegar a Sentry. */
  error: (event: string, error?: unknown, fields?: Record<string, unknown>) => {
    write("error", event, { ...(error === undefined ? {} : { error: describeError(error) }), ...fields });
    if (error !== undefined) captureException(error, event, fields);
  },
};
