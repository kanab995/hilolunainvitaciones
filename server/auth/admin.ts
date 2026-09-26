import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { isAdminRole, type UserRoleId } from "@/lib/admin/roles";
import { routes } from "@/lib/routes";
import { getOrCreateCurrentUser } from "@/server/auth/current-user";
import { findUserRole } from "@/server/repositories/users";
import type { AppUser } from "@/server/services/user-sync";

/**
 * AUTORIZACIÓN DE LA CONSOLA (D-33) — el ÚNICO punto que decide quién es administrador. `requireAdmin()`:
 *  1. exige sesión de Clerk (`getOrCreateCurrentUser`: sin sesión → /sign-in),
 *  2. resuelve el `User` de la base de datos,
 *  3. lee su `role` de PostgreSQL y exige `=== "ADMIN"`.
 * Falla de forma SEGURA: cualquier duda (sin rol, rol desconocido, sin base de datos, error al leer) es «no administrador» y responde
 * `notFound()`, igual que una ruta que no existe. No hay otra vía: ni el email, ni el dominio, ni un parámetro de URL, ni metadatos
 * de Clerk enviados por el navegador conceden privilegios. Toda página Y toda Server Action de `/admin/**` llama a esta función; el
 * menú oculto no es una barrera.
 */
export interface AdminUser extends AppUser {
  role: "ADMIN";
}

export type AdminResolution = { status: "ok"; admin: AdminUser } | { status: "unauthenticated" } | { status: "forbidden" };

export interface AdminGateDeps {
  currentUser: () => Promise<AppUser | null>;
  findRole: (userId: string) => Promise<UserRoleId | null>;
}

const defaultDeps: AdminGateDeps = { currentUser: getOrCreateCurrentUser, findRole: findUserRole };

/** Lógica pura sobre dependencias (se prueba sin Clerk ni base de datos). */
export async function resolveAdminWith(deps: AdminGateDeps): Promise<AdminResolution> {
  const user = await deps.currentUser();
  if (!user) return { status: "unauthenticated" };
  let role: UserRoleId | null;
  try {
    role = await deps.findRole(user.id);
  } catch {
    // Un fallo al leer el rol nunca concede acceso.
    return { status: "forbidden" };
  }
  return isAdminRole(role) ? { status: "ok", admin: { id: user.id, email: user.email, name: user.name, role: "ADMIN" } } : { status: "forbidden" };
}

/** Memoizado por petición: el layout y la página comparten la misma comprobación. */
export const resolveAdmin = cache(() => resolveAdminWith(defaultDeps));

/** Para páginas y Server Actions: devuelve al administrador o redirige a /sign-in (sin sesión) / responde 404 (sin privilegios). */
export async function requireAdmin(): Promise<AdminUser> {
  const resolution = await resolveAdmin();
  if (resolution.status === "unauthenticated") redirect(routes.signIn);
  if (resolution.status === "forbidden") notFound();
  // Tras `redirect`/`notFound` (que lanzan) solo queda `ok`; el `if` mantiene el estrechamiento de tipos.
  if (resolution.status !== "ok") notFound();
  return resolution.admin;
}

/** ¿La sesión actual es de un administrador? Solo para mostrar u ocultar el enlace «Administración»; nunca es una barrera. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  return (await resolveAdmin()).status === "ok";
}
