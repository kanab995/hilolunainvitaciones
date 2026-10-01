import { redactString } from "@/server/observability/redact";

/**
 * MONITOREO DE ERRORES (D-37, opcional). Abstracción MÍNIMA: un único punto de entrada (`captureException`), llamado SOLO por
 * `server/observability/logger.ts` (`logger.error`) — nadie más importa `@sentry/node` ni conoce que existe. Sin `SENTRY_DSN`,
 * este módulo no hace nada (ni se importa el SDK): coste cero en desarrollo y en cualquier entorno sin configurar.
 *
 * QUÉ SE CAPTURA: exactamente lo que ya llega a `logger.error(evento, error, campos)` — excepciones del servidor, fallos de ruta,
 * del webhook de Stripe y de subida de imágenes (todo lo que ya usaba el registro). No hay una integración aparte que capture
 * más que eso.
 *
 * QUÉ NUNCA SE ENVÍA (mismas reglas que el registro, reforzadas en `beforeSend`/`beforeBreadcrumb`):
 *  - `event.request` se elimina siempre (nunca cuerpo, cabeceras, cookies ni query string de la petición).
 *  - `event.user` se elimina siempre (nunca correo ni id de Clerk).
 *  - El mensaje de la excepción y las migas de pan pasan por `redactString` (los mismos patrones que el registro: claves `sk_…`,
 *    `whsec_…`, `re_…`, correos, tokens de invitación de 32+ caracteres…): un mensaje de error que por accidente incluyera un
 *    correo, un token o una clave llega igual de saneado que al registro. La PILA (nombres de archivo/función/línea) SÍ se
 *    conserva: es la parte con valor de depuración y no contiene datos de personas.
 *  - Sin tracing de rendimiento (`tracesSampleRate: 0`): D-37 pide una muestra conservadora: 0 es lo más conservador posible y
 *    evita que Sentry reciba duraciones/rutas de peticiones que no aportan al objetivo (capturar errores).
 */
export interface MonitoringEnv {
  SENTRY_DSN?: string | undefined;
  SENTRY_ENVIRONMENT?: string | undefined;
  APP_ENV?: string | undefined;
  NODE_ENV?: string | undefined;
}

export type MonitoringConfigResult = { status: "ready"; dsn: string; environment: string } | { status: "not_configured" } | { status: "invalid"; problem: string };

export function resolveMonitoringConfig(env: MonitoringEnv = process.env): MonitoringConfigResult {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) return { status: "not_configured" };
  if (!/^https?:\/\/[^\s]+@[^\s]+\/\d+$/.test(dsn)) return { status: "invalid", problem: "SENTRY_DSN no tiene el formato de un DSN de Sentry (https://<clave>@<host>/<id>)." };
  const environment = env.SENTRY_ENVIRONMENT?.trim() || env.APP_ENV?.trim() || env.NODE_ENV?.trim() || "development";
  return { status: "ready", dsn, environment };
}

/** Formas mínimas (subconjunto de las de `@sentry/node`) para poder sanear y probar sin importar el SDK completo. */
export interface ScrubbableBreadcrumb {
  message?: string;
  data?: unknown;
}
export interface ScrubbableEvent {
  request?: unknown;
  user?: unknown;
  message?: string;
  exception?: { values?: Array<{ value?: string }> };
  extra?: Record<string, unknown>;
}

/** Migas de pan: el texto libre se sanea y se descarta cualquier dato adjunto (puede llevar URLs con querystring, cuerpos…). */
export function scrubBreadcrumb<T extends ScrubbableBreadcrumb>(breadcrumb: T): T {
  if (typeof breadcrumb.message === "string") breadcrumb.message = redactString(breadcrumb.message).slice(0, 300);
  delete breadcrumb.data;
  return breadcrumb;
}

/** Evento de Sentry: nunca la petición ni el usuario; el mensaje, las excepciones y `extra` se sanean como el registro. */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  delete event.request;
  delete event.user;
  if (event.message) event.message = redactString(String(event.message)).slice(0, 500);
  for (const value of event.exception?.values ?? []) if (value.value) value.value = redactString(String(value.value)).slice(0, 500);
  if (event.extra) for (const key of Object.keys(event.extra)) if (typeof event.extra[key] === "string") event.extra[key] = redactString(String(event.extra[key])).slice(0, 500);
  return event;
}

type SentryModule = typeof import("@sentry/node");
/** `undefined` = todavía no se intentó cargar; `null` = no configurado o la carga falló (no se reintenta cada vez). */
let sentryModule: SentryModule | null | undefined;
let initialized = false;

async function loadSentry(): Promise<SentryModule | null> {
  const config = resolveMonitoringConfig();
  if (config.status !== "ready") return null;
  if (sentryModule !== undefined) return sentryModule;
  try {
    const mod = await import("@sentry/node");
    sentryModule = mod;
  } catch {
    // El SDK no se pudo cargar (p. ej. entorno edge, o el paquete no está disponible): el monitoreo se apaga en silencio, nunca rompe la app.
    sentryModule = null;
    return null;
  }
  if (!initialized) {
    sentryModule.init({
      dsn: config.dsn,
      environment: config.environment,
      // `@sentry/node` (a diferencia de `@sentry/nextjs`) no adjunta datos de la petición por su cuenta; aun así se
      // eliminan explícitamente en `beforeSend` (no hay un interruptor `sendDefaultPii` en esta versión del SDK).
      tracesSampleRate: 0,
      maxBreadcrumbs: 20,
      beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
      beforeSend: (event) => scrubEvent(event),
    });
    initialized = true;
  }
  return sentryModule;
}

/**
 * Reenvía una excepción a Sentry si está configurado. `event`/`fields` son SOLO etiquetas cortas (nunca valores libres): se
 * adjuntan como `tags` (Sentry los indexa; no deben llevar texto libre). Nunca lanza ni bloquea al llamador — un fallo del propio
 * monitoreo no debe sumarse al error original.
 */
export function captureException(error: unknown, event: string, fields?: Record<string, unknown>): void {
  void loadSentry()
    .then((sentry) => {
      if (!sentry) return;
      const tags: Record<string, string> = { event };
      for (const [key, value] of Object.entries(fields ?? {})) {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") tags[key] = redactString(String(value)).slice(0, 200);
      }
      sentry.captureException(error, { tags });
    })
    .catch(() => undefined);
}
