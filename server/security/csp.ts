/**
 * CABECERAS DE SEGURIDAD Y CSP (preproducción). Módulo PURO y sin alias de importación: lo usa `next.config.ts` (que no resuelve `@/`) y lo
 * prueban los tests. Estrategia y excepciones documentadas en docs/ARCHITECTURE.md (D-34) y docs/DEPLOYMENT.md.
 *
 * CSP (versión compatible con el stack actual, sin nonce):
 *  - `script-src 'self' 'unsafe-inline'` + el host EXACTO de Clerk (derivado de la clave pública) y Cloudflare Turnstile. EXCEPCIÓN
 *    DOCUMENTADA: Next.js (App Router) emite scripts en línea para hidratar (payload RSC) y una CSP con nonce obliga a renderizar
 *    TODAS las páginas de forma dinámica (perdería las páginas estáticas de marketing y añade un proxy con nonce por petición). Se
 *    mitiga con `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'self'`, sin `script-src *`, sin comodines globales y sin
 *    `unsafe-eval` en producción. Siguiente paso posible: CSP con nonce si se acepta el coste de renderizado dinámico.
 *  - Stripe: el pago es una REDIRECCIÓN a Stripe Checkout alojado; el navegador no carga Stripe.js. Por eso no hay hosts de Stripe en
 *    `script-src`; solo `form-action` admite `https://checkout.stripe.com`.
 *  - R2/S3: `connect-src` admite el origen del endpoint (subida directa con URL firmada) e `img-src` el de `S3_PUBLIC_BASE_URL`.
 *  - Sin comodines globales: cada host se deriva de la configuración; sin configuración no se añade.
 *  - `frame-ancestors 'self'` (y `X-Frame-Options: SAMEORIGIN`): el editor incrusta la vista previa del MISMO origen en un iframe.
 *  - `CSP_REPORT_ONLY=true` envía la política como `Content-Security-Policy-Report-Only` (interruptor operativo para diagnosticar en
 *    staging sin bloquear nada).
 */
import { isStagingEnv, readAppEnv } from "../config/app-env";

export type SecurityEnv = Readonly<Record<string, string | undefined>>;

export interface Header {
  key: string;
  value: string;
}

const originOf = (raw: string | undefined): string | undefined => {
  if (!raw?.trim()) return undefined;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Host del «Frontend API» de Clerk: la clave pública es `pk_(test|live)_` + base64(«host$»). Devuelve `https://<host>` o `undefined`.
 * Nunca se usa la clave secreta.
 */
export function clerkFrontendOrigin(publishableKey: string | undefined): string | undefined {
  const match = /^pk_(?:test|live)_([A-Za-z0-9+/=_-]+)$/.exec(publishableKey?.trim() ?? "");
  if (!match?.[1]) return undefined;
  try {
    const decoded = Buffer.from(match[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const host = decoded.replace(/\$$/, "");
    return /^[a-z0-9.-]+$/i.test(host) && host.includes(".") ? `https://${host}` : undefined;
  } catch {
    return undefined;
  }
}

const unique = (values: Array<string | undefined>): string[] => [...new Set(values.filter((value): value is string => Boolean(value)))];

export function buildCsp(env: SecurityEnv): string {
  const production = env.NODE_ENV === "production";
  const clerk = clerkFrontendOrigin(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const storageEndpoint = originOf(env.S3_ENDPOINT);
  const mediaOrigin = originOf(env.S3_PUBLIC_BASE_URL);
  const turnstile = "https://challenges.cloudflare.com";

  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    // `unsafe-eval` solo en desarrollo (React lo usa para las herramientas de depuración).
    ["script-src", unique(["'self'", "'unsafe-inline'", production ? undefined : "'unsafe-eval'", clerk, turnstile])],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", unique(["'self'", "data:", "blob:", mediaOrigin, "https://img.clerk.com"])],
    ["font-src", ["'self'", "data:"]],
    ["connect-src", unique(["'self'", clerk, "https://clerk-telemetry.com", storageEndpoint, production ? undefined : "ws:", production ? undefined : "wss:"])],
    ["frame-src", unique(["'self'", clerk, turnstile])],
    ["worker-src", ["'self'", "blob:"]],
    ["media-src", unique(["'self'", mediaOrigin])],
    ["manifest-src", ["'self'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", unique(["'self'", "https://checkout.stripe.com", clerk])],
    ["frame-ancestors", ["'self'"]],
  ];
  const parts = directives.map(([name, values]) => `${name} ${values.join(" ")}`);
  if (production) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/**
 * HUELLA de la CSP calculada al BUILD. `next.config.ts` evalúa `headers()` al construir: los orígenes de Clerk, S3/R2 y medios salen de las variables
 * de ENTORNO DEL BUILD, no de las del servidor en ejecución. `next.config.ts` la inyecta como `HILOLUNA_CSP_FINGERPRINT` y el arranque la compara con la de
 * las variables actuales: si difieren avisa «vuelve a construir» (una CSP sin el origen de R2 bloquearía las subidas de imágenes).
 */
export function cspFingerprint(env: SecurityEnv): string {
  // cyrb53: hash simple y determinista SIN `node:crypto` (este módulo también lo importa `instrumentation.ts`, que Next compila para varios runtimes).
  // Además de la CSP entran las variables que Next fija al build y que cambian el comportamiento: entorno (noindex de staging, robots) y URL del sitio.
  const text = `${buildCsp(env)}|${readAppEnv(env) ?? ""}|${originOf(env.NEXT_PUBLIC_SITE_URL) ?? ""}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

const NO_INDEX = { key: "X-Robots-Tag", value: "noindex, nofollow" } satisfies Header;

/** Cabeceras de seguridad de TODAS las respuestas. */
export function baseSecurityHeaders(env: SecurityEnv): Header[] {
  const reportOnly = ["1", "true", "yes"].includes((env.CSP_REPORT_ONLY ?? "").toLowerCase());
  const headers: Header[] = [
    { key: reportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy", value: buildCsp(env) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    // Sin cámara, micrófono, geolocalización, pagos del navegador ni USB/Bluetooth: la app no los usa.
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), interest-cohort=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ];
  if (env.NODE_ENV === "production") headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  // Staging: TODO el sitio noindex/nofollow (no debe aparecer en buscadores); robots.txt también lo bloquea entero.
  if (isStagingEnv(env)) headers.push(NO_INDEX);
  return headers;
}

/**
 * Reglas por ruta para `headers()` de Next. Las últimas reglas ganan en las cabeceras repetidas:
 *  - Invitaciones (`/i/**`, incluido `calendar.ics`): NO indexables, SIN `Referer` (el token del invitado viaja en la URL) y nunca en
 *    cachés compartidas.
 *  - Panel, consola, vista previa y acceso: NO indexables.
 */
export function securityHeaderRules(env: SecurityEnv): Array<{ source: string; headers: Header[] }> {
  return [
    { source: "/:path*", headers: baseSecurityHeaders(env) },
    {
      source: "/i/:path*",
      headers: [NO_INDEX, { key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "private, no-store" }],
    },
    { source: "/dashboard/:path*", headers: [NO_INDEX, { key: "Cache-Control", value: "private, no-store" }] },
    { source: "/admin/:path*", headers: [NO_INDEX, { key: "Cache-Control", value: "private, no-store" }] },
    { source: "/preview/:path*", headers: [NO_INDEX, { key: "Cache-Control", value: "private, no-store" }] },
    { source: "/sign-in/:path*", headers: [NO_INDEX] },
    { source: "/sign-up/:path*", headers: [NO_INDEX] },
    { source: "/api/:path*", headers: [NO_INDEX, { key: "Cache-Control", value: "no-store" }] },
  ];
}
