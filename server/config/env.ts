import { PRICE_ENV_KEYS } from "@/lib/billing/plans";
import { siteConfig } from "@/lib/site-config";
import { resolveStripeConfig } from "@/server/billing/stripe/config";
import { readAppEnv } from "@/server/config/app-env";
import { parseStagingAllowlist, resolveEmailConfig } from "@/server/email/config";

/**
 * VALIDACIÓN CENTRAL DEL ENTORNO (preproducción). Lógica pura sobre un objeto de entorno: se prueba sin tocar `process.env`.
 * Reglas:
 *  - Cada variable pertenece a un GRUPO y tiene un nivel: `required` (sin ella el servicio no puede funcionar), `optional`.
 *  - En PRODUCCIÓN todo lo `required` debe existir y ser coherente: si falta algo crítico el arranque FALLA con un error claro (ver
 *    `startup.ts`); la aplicación nunca arranca a medias ni renderiza páginas rotas. En desarrollo faltan cosas a propósito (modo
 *    demostración, Stripe sin configurar…): solo se informan como avisos.
 *  - Los problemas nombran VARIABLES y explican qué falta; jamás incluyen un valor (ni parcial).
 *  - Secretos: ninguna variable sin prefijo `NEXT_PUBLIC_` llega al navegador; esta validación solo se ejecuta en el servidor.
 */
export type EnvSource = Readonly<Record<string, string | undefined>>;
export type EnvGroup = "app" | "database" | "clerk" | "storage" | "stripe" | "rateLimit" | "email";
export type EnvSeverity = "error" | "warning";

export interface EnvProblem {
  group: EnvGroup;
  severity: EnvSeverity;
  /** Variable afectada (nunca su valor). */
  variable: string;
  message: string;
}

export interface EnvReport {
  mode: "production" | "development";
  problems: EnvProblem[];
  /** `true` si no hay ningún problema de severidad `error`. */
  ok: boolean;
}

const has = (env: EnvSource, name: string): boolean => Boolean(env[name]?.trim());
const value = (env: EnvSource, name: string): string => env[name]?.trim() ?? "";

function parseUrl(raw: string): URL | undefined {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

const isLocalHost = (hostname: string) => hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname.endsWith(".localhost");

/** Variables de S3/R2 obligatorias para subir imágenes (`S3_REGION` es opcional: por defecto `auto`). */
export const STORAGE_REQUIRED = ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_PUBLIC_BASE_URL"] as const;

/** Proveedor de límite de tasa compatible con la API REST de Upstash Redis (ver `docs/DEPLOYMENT.md`). */
export const RATE_LIMIT_VARIABLES = ["RATE_LIMIT_REST_URL", "RATE_LIMIT_REST_TOKEN"] as const;

export function validateEnv(env: EnvSource, mode: EnvReport["mode"] = env.NODE_ENV === "production" ? "production" : "development"): EnvReport {
  const production = mode === "production";
  const problems: EnvProblem[] = [];
  /** En producción falta = error; en desarrollo = aviso (o nada si `quietInDev`). */
  const need = (group: EnvGroup, variable: string, message: string, quietInDev = false) => {
    if (has(env, variable)) return true;
    if (production) problems.push({ group, severity: "error", variable, message });
    else if (!quietInDev) problems.push({ group, severity: "warning", variable, message });
    return false;
  };
  const problem = (group: EnvGroup, severity: EnvSeverity, variable: string, message: string) => problems.push({ group, severity, variable, message });

  // ───────── Entorno de despliegue (APP_ENV) ─────────
  // Staging y producción son ambos NODE_ENV=production: `APP_ENV` es lo que los distingue (noindex global, claves de prueba, recursos propios).
  const appEnv = readAppEnv(env);
  if (appEnv === "invalid") problem("app", production ? "error" : "warning", "APP_ENV", "Valor desconocido: usa development, staging o production.");
  else if (production && !appEnv) problem("app", "error", "APP_ENV", "Declara el entorno de despliegue: staging o production (evita indexar staging o mezclar claves de prueba con las reales).");
  else if (production && appEnv === "development") problem("app", "error", "APP_ENV", "Un despliegue con NODE_ENV=production debe declarar APP_ENV=staging o production.");
  const staging = appEnv === "staging";

  // ───────── App ─────────
  if (need("app", "NEXT_PUBLIC_SITE_URL", "Falta la URL pública del sitio (producción: https://hiloluna.com).", true)) {
    const url = parseUrl(value(env, "NEXT_PUBLIC_SITE_URL"));
    if (!url) problem("app", "error", "NEXT_PUBLIC_SITE_URL", "No es una URL http(s) válida.");
    else if (production && url.protocol !== "https:") problem("app", "error", "NEXT_PUBLIC_SITE_URL", "En producción debe ser https.");
    else if (production && isLocalHost(url.hostname)) problem("app", "error", "NEXT_PUBLIC_SITE_URL", "En producción no puede apuntar a localhost.");
    else if (url.pathname !== "/" && url.pathname !== "") problem("app", "warning", "NEXT_PUBLIC_SITE_URL", "Debe ser solo el origen (sin ruta ni barra final).");
    if (url && production && staging && (url.hostname === siteConfig.domain || url.hostname === `www.${siteConfig.domain}`)) problem("app", "error", "NEXT_PUBLIC_SITE_URL", "Staging no puede usar el dominio de producción (usa p. ej. https://staging.<dominio>).");
  }

  // ───────── Base de datos ─────────
  if (need("database", "DATABASE_URL", "Sin base de datos la aplicación usa datos de demostración en memoria (solo lectura).")) {
    if (!/^postgres(ql)?:\/\//.test(value(env, "DATABASE_URL"))) problem("database", "error", "DATABASE_URL", "No es una URL de PostgreSQL (postgresql://…).");
  }

  // ───────── Clerk ─────────
  const clerkPublic = need("clerk", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "Falta la clave pública de Clerk: sin ella nadie puede iniciar sesión.", true);
  const clerkSecret = need("clerk", "CLERK_SECRET_KEY", "Falta la clave secreta de Clerk (solo servidor).", true);
  if (production && clerkPublic && !/^pk_(test|live)_/.test(value(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"))) problem("clerk", "error", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "No tiene el formato de una clave pública de Clerk (pk_test_… / pk_live_…).");
  if (production && clerkSecret && !/^sk_(test|live)_/.test(value(env, "CLERK_SECRET_KEY"))) problem("clerk", "error", "CLERK_SECRET_KEY", "No tiene el formato de una clave secreta de Clerk (sk_test_… / sk_live_…).");
  if (production && clerkPublic && clerkSecret) {
    const mode = (name: string) => (value(env, name).includes("_live_") ? "live" : "test");
    if (mode("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY") !== mode("CLERK_SECRET_KEY")) problem("clerk", "error", "CLERK_SECRET_KEY", "Las claves de Clerk son de instancias distintas (test / live).");
  }

  // Staging solo con claves de PRUEBA (nunca `_live_`); producción con claves de prueba se avisa (puede ser un primer arranque intencional).
  if (production && (staging || appEnv === "production")) {
    const liveOrTest = staging ? "live" : "test";
    const offending = ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"].filter((name) => value(env, name).includes(`_${liveOrTest}_`));
    for (const name of offending) {
      problem(name.includes("STRIPE") ? "stripe" : "clerk", staging ? "error" : "warning", name, staging ? "Staging solo puede usar claves de PRUEBA (test), nunca de producción (live)." : "Producción está usando una clave de PRUEBA (test): no es un despliegue real todavía.");
    }
  }

  // ───────── Almacenamiento (S3 / R2) ─────────
  if (production && staging && has(env, "S3_BUCKET") && !value(env, "S3_BUCKET").toLowerCase().includes("staging")) problem("storage", "warning", "S3_BUCKET", "El bucket de staging debería ser propio y llamarse de forma que lo distinga (p. ej. hiloluna-staging-media): no reutilices el bucket de producción.");
  for (const variable of STORAGE_REQUIRED) need("storage", variable, "Sin almacenamiento de imágenes las subidas quedan desactivadas.", true);
  if (has(env, "S3_PUBLIC_BASE_URL")) {
    const base = parseUrl(value(env, "S3_PUBLIC_BASE_URL"));
    if (!base) problem("storage", "error", "S3_PUBLIC_BASE_URL", "No es una URL http(s) válida.");
    else if (production && (base.protocol !== "https:" || isLocalHost(base.hostname))) problem("storage", "error", "S3_PUBLIC_BASE_URL", "En producción debe ser https y no puede apuntar a localhost (p. ej. https://media.hiloluna.com).");
    else if (value(env, "S3_PUBLIC_BASE_URL").endsWith("/")) problem("storage", "warning", "S3_PUBLIC_BASE_URL", "Sin barra final.");
  }
  if (has(env, "S3_ENDPOINT") && !parseUrl(value(env, "S3_ENDPOINT"))) problem("storage", "error", "S3_ENDPOINT", "No es una URL http(s) válida.");
  if (!production) {
    const present = STORAGE_REQUIRED.filter((name) => has(env, name));
    if (present.length > 0 && present.length < STORAGE_REQUIRED.length) problem("storage", "warning", "S3_BUCKET", "La configuración de almacenamiento está incompleta: las subidas seguirán desactivadas.");
  }

  // ───────── Stripe ─────────
  const stripeVariables = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", ...PRICE_ENV_KEYS];
  for (const variable of stripeVariables) need("stripe", variable, variable === "STRIPE_WEBHOOK_SECRET" ? "Sin el secreto del webhook no se podrían activar los planes tras el pago." : "Falta la configuración de pagos (Stripe).", true);
  const stripe = resolveStripeConfig(env);
  if (stripe.status === "invalid") {
    for (const message of stripe.problems) {
      const named = stripeVariables.find((name) => message.includes(name)) ?? "STRIPE_SECRET_KEY";
      // Las variables ausentes ya se reportaron arriba: aquí solo lo incoherente.
      if (has(env, named)) problem("stripe", production ? "error" : "warning", named, message);
    }
  }

  // ───────── Límite de tasa (proveedor externo) ─────────
  const rateLimitConfigured = RATE_LIMIT_VARIABLES.every((name) => has(env, name));
  const rateLimitPartial = RATE_LIMIT_VARIABLES.some((name) => has(env, name)) && !rateLimitConfigured;
  const required = ["1", "true", "yes"].includes(value(env, "RATE_LIMIT_REQUIRED").toLowerCase());
  if (rateLimitPartial) problem("rateLimit", production ? "error" : "warning", "RATE_LIMIT_REST_TOKEN", "La configuración del proveedor de límite de tasa está incompleta (hacen falta RATE_LIMIT_REST_URL y RATE_LIMIT_REST_TOKEN).");
  else if (!rateLimitConfigured && production) {
    problem("rateLimit", required ? "error" : "warning", "RATE_LIMIT_REST_URL", required ? "RATE_LIMIT_REQUIRED está activo pero no hay proveedor de límite de tasa configurado." : "SIN LÍMITE DE TASA: los endpoints públicos (RSVP, enlaces de invitado, subidas) no están protegidos contra abuso. Configura un proveedor (docs/DEPLOYMENT.md).");
  }
  if (rateLimitConfigured && !parseUrl(value(env, "RATE_LIMIT_REST_URL"))) problem("rateLimit", "error", "RATE_LIMIT_REST_URL", "No es una URL http(s) válida.");

  // ───────── Correo transaccional (D-36) ─────────
  const emailResult = resolveEmailConfig(env);
  const emailRequired = ["1", "true", "yes"].includes(value(env, "EMAIL_REQUIRED").toLowerCase());
  if (emailResult.status === "invalid") {
    for (const message of emailResult.problems) {
      const named = message.includes("EMAIL_FROM") ? "EMAIL_FROM" : message.includes("EMAIL_REPLY_TO") ? "EMAIL_REPLY_TO" : "RESEND_API_KEY";
      problem("email", production ? "error" : "warning", named, message);
    }
  } else if (emailResult.status === "not_configured" && production) {
    problem("email", emailRequired ? "error" : "warning", "RESEND_API_KEY", emailRequired ? "EMAIL_REQUIRED está activo pero no hay proveedor de correo configurado." : "SIN CORREO TRANSACCIONAL: no se avisará al anfitrión de RSVP ni de compras confirmadas. Configura Resend (docs/EMAIL.md) o déjalo así a propósito por ahora.");
  }
  if (production && staging && emailResult.status === "ready") {
    const allowlist = parseStagingAllowlist(env);
    if (allowlist.length === 0) problem("email", "warning", "EMAIL_STAGING_ALLOWLIST", "Sin lista, staging no manda NINGÚN correo (fail-closed): añade los correos de prueba autorizados en Resend.");
  }

  return { mode, problems, ok: !problems.some((item) => item.severity === "error") };
}

/** Texto para el registro y para el error de arranque: variables y motivos, nunca valores. */
export function formatEnvProblems(report: EnvReport, severity: EnvSeverity = "error"): string {
  return report.problems
    .filter((item) => item.severity === severity)
    .map((item) => `  - [${item.group}] ${item.variable}: ${item.message}`)
    .join("\n");
}
