import { logger } from "@/server/observability/logger";
/**
 * ORIGEN DE LOS DATOS (docs/ARCHITECTURE.md D-22).
 *  - Con `DATABASE_URL` definida, los repositorios leen y escriben en PostgreSQL con Prisma.
 *  - Sin ella, leen los datos de demostración (`server/seed/demo-data.ts`, los mismos que carga el seed)
 *    desde memoria, en solo lectura. Permite compilar y desarrollar sin base de datos; se retirará
 *    cuando el entorno de desarrollo siempre tenga una (deuda técnica registrada).
 */
export type DataSource = "database" | "demo";

let warned = false;

export function getDataSource(env: Record<string, string | undefined> = process.env): DataSource {
  if (env.DATABASE_URL) return "database";
  if (!warned && process.env.NODE_ENV !== "test") {
    warned = true;
    logger.warn("data_source.demo_mode", { note: "DATABASE_URL no está definida: se usan los datos de demostración en memoria (solo lectura)." });
  }
  return "demo";
}
