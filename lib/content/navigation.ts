import type { NavItem } from "@/types/marketing";
import { routes } from "@/lib/routes";

/** Navegación principal de las páginas públicas de marketing (mockups 01–03). */
export const mainNav: readonly NavItem[] = [
  { label: "Plantillas", href: routes.templates },
  { label: "Cómo funciona", href: routes.howItWorks },
  { label: "Precios", href: routes.pricing },
];

/** Estado de la sesión que ve la navbar pública (la resuelve Clerk en el cliente; ver `AuthStateBoundary`). */
export type AuthNavState = "loading" | "signed-in" | "signed-out";

/**
 * Enlace de cuenta de la navbar: "Entrar" sin sesión, "Mi panel" con sesión. Nunca muestra "Entrar" a
 * una persona autenticada. Mientras se resuelve la sesión no hay enlace (`undefined`): el espacio se
 * reserva para evitar el parpadeo "Entrar" → "Mi panel".
 */
export function getAccountNavItem(state: AuthNavState): NavItem | undefined {
  if (state === "loading") return undefined;
  return state === "signed-in" ? { label: "Mi panel", href: routes.dashboard } : { label: "Entrar", href: routes.signIn };
}

/** CTA de la navbar: sin sesión lleva al registro; con sesión, a elegir plantilla. */
export function getHeaderCta(state: AuthNavState): NavItem {
  return { label: "Crear invitación", href: state === "signed-in" ? routes.templates : routes.signUp };
}

/** Enlaces del pie (mockup 01). */
export const footerNav: readonly NavItem[] = [
  { label: "Plantillas", href: routes.templates },
  { label: "Precios", href: routes.pricing },
  { label: "Contacto", href: routes.contact },
  { label: "Términos", href: routes.terms },
  { label: "Privacidad", href: routes.privacy },
];
