/**
 * ENTORNO DE DESPLIEGUE (`APP_ENV`). Módulo PURO y sin alias de importación (lo usa `next.config.ts` vía `server/security/csp.ts`).
 *
 * `NODE_ENV` no basta: staging y producción son AMBOS `NODE_ENV=production` (`next build` + `next start`). `APP_ENV` declara cuál es:
 *   development  máquina local (modo de demostración permitido).
 *   staging      entorno de pruebas real (claves de PRUEBA, base y bucket propios, TODO noindex).
 *   production   entorno real.
 * Se lee al BUILD (cabeceras, robots y sitemap se generan entonces) y al arrancar (validación): por eso forma parte de la huella de build
 * (`cspFingerprint`) y debe ser igual en ambos momentos. Ver docs/DEPLOYMENT.md §3.
 */
export type AppEnvironment = "development" | "staging" | "production";

export const APP_ENVIRONMENTS: readonly AppEnvironment[] = ["development", "staging", "production"];

type Env = Readonly<Record<string, string | undefined>>;

/** `undefined` = no declarado; `"invalid"` = valor desconocido. */
export function readAppEnv(env: Env): AppEnvironment | "invalid" | undefined {
  const raw = env.APP_ENV?.trim().toLowerCase();
  if (!raw) return undefined;
  return (APP_ENVIRONMENTS as readonly string[]).includes(raw) ? (raw as AppEnvironment) : "invalid";
}

/** ¿Es staging? En staging TODO el sitio es noindex/nofollow (cabecera, robots y sitemap vacío). */
export const isStagingEnv = (env: Env): boolean => readAppEnv(env) === "staging";
