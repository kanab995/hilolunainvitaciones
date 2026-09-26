import { cache } from "react";
import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";
import { getAuthMode } from "@/server/auth/mode";
import { getClerkSession } from "@/server/auth/session";
import { getDemoUser, prismaUserStore } from "@/server/repositories/users";
import { syncUser, type AppUser } from "@/server/services/user-sync";

/**
 * USUARIO ACTUAL: único punto que traduce "sesión de Clerk" en "perfil interno". Las páginas nunca
 * llaman a `auth()`, `currentUser()` ni a Prisma para esto.
 *  - `getOrCreateCurrentUser()`: el `User` de la sesión (lo crea o vincula la primera vez) o `null` sin
 *    sesión. Memoizado por petición (layout y página comparten el resultado).
 *  - `requireAuth()`: como la anterior pero redirige a /sign-in si no hay sesión.
 * En modo `demo` (solo desarrollo, sin claves) devuelve el usuario demo.
 */
export const getOrCreateCurrentUser = cache(async (): Promise<AppUser | null> => {
  const mode = getAuthMode();
  if (mode === "demo") return getDemoUser();
  if (mode !== "clerk") return null;

  const session = await getClerkSession();
  if (!session) return null;
  return syncUser(prismaUserStore, session.clerkUserId, session.loadProfile);
});

export async function requireAuth(): Promise<AppUser> {
  const user = await getOrCreateCurrentUser();
  if (!user) redirect(routes.signIn);
  return user;
}
