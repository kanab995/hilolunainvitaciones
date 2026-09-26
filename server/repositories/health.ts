import { getDataSource } from "@/server/data-source";
import { prisma } from "@/server/db/client";

/** ¿Responde la base de datos? (`SELECT 1`). Sin `DATABASE_URL` (origen de demostración) no hay base de datos: `false`. Nunca lanza por falta de configuración. */
export async function pingDatabase(): Promise<boolean> {
  if (getDataSource() === "demo") return false;
  await prisma.$queryRaw`SELECT 1`;
  return true;
}
