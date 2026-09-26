import { formatEnvProblems, validateEnv, type EnvReport, type EnvSource } from "@/server/config/env";
import { logger } from "@/server/observability/logger";
import { cspFingerprint } from "@/server/security/csp";

/**
 * COMPROBACIÓN DE ARRANQUE (preproducción). La ejecuta `instrumentation.ts` una vez al iniciar el servidor:
 *  - En PRODUCCIÓN, si falta o es incoherente algo crítico (base de datos, Clerk, Stripe, webhook, precios, S3/R2, URL del sitio), el
 *    proceso FALLA al arrancar con un error claro que nombra las variables (nunca sus valores): no se sirve ninguna página a medias.
 *  - Los avisos (p. ej. «sin límite de tasa») se escriben en el registro pero no impiden arrancar, salvo `RATE_LIMIT_REQUIRED=true`.
 *  - En desarrollo nunca falla: el modo de demostración es legítimo.
 * No se ejecuta durante `next build` (el build no necesita secretos): la fase de build lo indica con `NEXT_PHASE`.
 */
export class StartupConfigError extends Error {
  constructor(readonly report: EnvReport) {
    super(`Configuración de producción incompleta o inválida. Corrige estas variables de entorno y reinicia:\n${formatEnvProblems(report)}`);
    this.name = "StartupConfigError";
  }
}

export interface StartupDeps {
  warn: (message: string) => void;
}

export function assertProductionEnv(env: EnvSource = process.env, deps: StartupDeps = { warn: (message) => logger.warn("startup.config_warnings", { detail: message }) }): EnvReport {
  const report = validateEnv(env);
  if (report.mode !== "production") return report;
  let warnings = formatEnvProblems(report, "warning");
  // La CSP y las imágenes remotas se calculan al BUILD con las variables del build: si difieren de las del servidor hay que reconstruir.
  const built = process.env.HILOLUNA_CSP_FINGERPRINT;
  if (built && built !== cspFingerprint(env)) warnings += `${warnings ? "\n" : ""}  - [app] APP_ENV / NEXT_PUBLIC_SITE_URL / la clave pública de Clerk / S3_ENDPOINT / S3_PUBLIC_BASE_URL / CSP_REPORT_ONLY: las variables del servidor no coinciden con las del build (la CSP, el noindex de staging, robots y las imágenes remotas se fijan al construir): vuelve a ejecutar npm run build con las mismas variables.`;
  if (warnings) deps.warn(`[hiloluna] avisos de configuración:\n${warnings}`);
  if (!report.ok) throw new StartupConfigError(report);
  return report;
}

/**
 * Comprobación de arranque de la aplicación: en producción, si la configuración crítica es inválida escribe el error (que nombra variables, nunca
 * valores) y TERMINA el proceso con código 1. Sin esto Next.js seguiría escuchando y respondería 500 a todo, ocultando el problema al host.
 * (La referencia a `process` se toma de `globalThis` para que el análisis del runtime edge de Next no la marque: este código solo corre en Node.)
 */
export function runStartupCheck(env: EnvSource = process.env): void {
  try {
    assertProductionEnv(env);
  } catch (error) {
    const node = globalThis.process;
    node.stderr.write(`\n[hiloluna] NO SE PUEDE ARRANCAR\n${error instanceof Error ? error.message : "Configuración inválida."}\n\n`);
    node.exit(1);
  }
}
