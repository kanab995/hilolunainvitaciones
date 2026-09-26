import { pingDatabase } from "@/server/repositories/health";
import { validateEnv } from "@/server/config/env";
import { logger } from "@/server/observability/logger";

/**
 * PREPARACIÓN (`/api/health/ready`): configuración crítica completa + base de datos alcanzable. Devuelve solo booleanos; los detalles (qué variable
 * falta) están en el registro de arranque y en la consola de administración, nunca en una respuesta pública.
 */
export interface Readiness {
  status: "ready" | "not_ready";
  checks: { config: boolean; database: boolean };
}

export interface ReadinessDeps {
  configOk: () => boolean;
  ping: () => Promise<boolean>;
}

const defaultDeps: ReadinessDeps = { configOk: () => validateEnv(process.env).ok, ping: pingDatabase };

export async function getReadiness(deps: ReadinessDeps = defaultDeps): Promise<Readiness> {
  const config = deps.configOk();
  let database = false;
  try {
    database = await deps.ping();
  } catch (error) {
    logger.warn("health.database_unreachable", { error: (error as { code?: string })?.code ?? "desconocido" });
  }
  return { status: config && database ? "ready" : "not_ready", checks: { config, database } };
}
