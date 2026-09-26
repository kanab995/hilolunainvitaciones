import { PrismaClient } from "@prisma/client";

/**
 * Cliente de Prisma ÚNICO. En desarrollo el recargado en caliente de Next.js vuelve a evaluar los
 * módulos; guardarlo en `globalThis` evita abrir una conexión nueva en cada recarga.
 * Solo `server/repositories` (y el seed) deben importar este módulo (CLAUDE.md regla 13).
 */
const globalForPrisma = globalThis as unknown as { hilolunaPrisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.hilolunaPrisma ?? new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.hilolunaPrisma = prisma;
