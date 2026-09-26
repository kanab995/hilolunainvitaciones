import type { AuthMode } from "@/server/auth/mode";

/**
 * QUÉ RUTAS SON PRIVADAS y qué se hace con cada petición. Lógica pura (sin Clerk): la usa `proxy.ts` y
 * la comprueban las pruebas. Públicas: `/`, `/templates/**`, `/i/**`, `/sign-in`, `/sign-up` y los
 * archivos estáticos. Privadas: todo `/dashboard/**`, la vista previa del editor `/preview/**`
 * (renderiza el borrador de un propietario) y la consola interna `/admin/**` (D-33: además de sesión exige el rol ADMIN,
 * que comprueba `requireAdmin()` en cada página y acción; el proxy es solo la primera barrera).
 */
export const PRIVATE_PREFIXES = ["/dashboard", "/preview", "/admin"] as const;

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export type AccessDecision = { action: "allow" } | { action: "redirect-sign-in" };

export function decideAccess(input: { pathname: string; mode: AuthMode; signedIn: boolean }): AccessDecision {
  if (!isPrivatePath(input.pathname)) return { action: "allow" };
  if (input.mode === "demo") return { action: "allow" };
  if (input.mode === "clerk" && input.signedIn) return { action: "allow" };
  return { action: "redirect-sign-in" };
}
