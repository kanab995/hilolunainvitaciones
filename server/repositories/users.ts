import type { UserRoleId } from "@/lib/admin/roles";
import { AuthSyncError } from "@/server/auth/errors";
import { getDataSource } from "@/server/data-source";
import { prisma } from "@/server/db/client";
import { uniqueViolationFields } from "@/server/db/errors";
import { DEMO_USER } from "@/server/seed/demo-data";
import { UniqueViolation, type AppUser, type StoredUser, type UserStore } from "@/server/services/user-sync";

const select = { id: true, clerkUserId: true, email: true, name: true } as const;

function requireDatabase(): void {
  if (getDataSource() === "demo") throw new AuthSyncError("database_unavailable", "Las cuentas reales requieren DATABASE_URL.");
}

/** Almacén de usuarios sobre Prisma para `syncUser`. Solo con base de datos. */
export const prismaUserStore: UserStore = {
  async findByClerkId(clerkUserId): Promise<StoredUser | null> {
    requireDatabase();
    return prisma.user.findUnique({ where: { clerkUserId }, select });
  },
  async findByEmail(email): Promise<StoredUser | null> {
    requireDatabase();
    return prisma.user.findUnique({ where: { email }, select });
  },
  async linkClerkId(userId, clerkUserId): Promise<boolean> {
    requireDatabase();
    try {
      // Compare-and-set: solo si sigue sin identidad (dos peticiones no pueden vincularlo a la vez).
      const { count } = await prisma.user.updateMany({ where: { id: userId, clerkUserId: null }, data: { clerkUserId } });
      return count === 1;
    } catch (error) {
      if (uniqueViolationFields(error)) return false;
      throw error;
    }
  },
  async create(input): Promise<StoredUser> {
    requireDatabase();
    try {
      return await prisma.user.create({ data: input, select });
    } catch (error) {
      const fields = uniqueViolationFields(error);
      if (fields) throw new UniqueViolation(fields);
      throw error;
    }
  },
};

/**
 * Usuario demo del seed, para el modo de desarrollo sin Clerk (`server/auth/mode.ts`). Nunca se usa en
 * producción. Con base de datos se lee por id; sin ella, es el usuario de los datos en memoria.
 */
export async function getDemoUser(): Promise<AppUser> {
  if (getDataSource() === "database") {
    const user = await prisma.user.findUnique({ where: { id: DEMO_USER.id }, select: { id: true, email: true, name: true } });
    if (user) return user;
  }
  return { id: DEMO_USER.id, email: DEMO_USER.email, name: DEMO_USER.name };
}

/**
 * Rol interno de una cuenta (D-33), leído SIEMPRE de PostgreSQL. Único origen de privilegios de la consola: no hay rol en el token de
 * sesión ni en Clerk. Sin base de datos (origen de demostración) no hay roles: `null` (= sin privilegios).
 */
export async function findUserRole(userId: string): Promise<UserRoleId | null> {
  if (getDataSource() === "demo") return null;
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return row?.role ?? null;
}
