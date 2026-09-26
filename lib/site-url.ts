import { routes } from "@/lib/routes";
import { siteConfig } from "@/lib/site-config";

/**
 * URL base del sitio. Orden de prioridad:
 *  1. `NEXT_PUBLIC_SITE_URL` (si es una URL http/https válida);
 *  2. producción sin variable → la URL canónica de la marca (`siteConfig.url`);
 *  3. desarrollo y pruebas → `http://localhost:3000`.
 * Sin barra final. Las variables `NEXT_PUBLIC_*` se leen con acceso estático (`process.env.X`) para que
 * Next.js las sustituya también en el código de cliente; por eso el parámetro por defecto las nombra.
 */
export interface SiteUrlEnv {
  NEXT_PUBLIC_SITE_URL?: string | undefined;
  NODE_ENV?: string | undefined;
}

export const LOCAL_SITE_URL = "http://localhost:3000";

export function getSiteUrl(env: SiteUrlEnv = { NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL, NODE_ENV: process.env.NODE_ENV }): string {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "http:" || url.protocol === "https:") return url.origin;
    } catch {
      // Valor inválido: se ignora y se usa el valor por defecto del entorno.
    }
  }
  return env.NODE_ENV === "production" ? siteConfig.url : LOCAL_SITE_URL;
}

/** URL pública de una invitación: `<base>/i/<slug>`. La base depende del entorno (`getSiteUrl`). */
export function getPublicInvitationUrl(slug: string, env?: SiteUrlEnv): string {
  return `${getSiteUrl(env)}${routes.invitation(slug)}`;
}

/**
 * Enlace personalizado de un invitado: `<base>/i/<slug>?guest=<token>`. Usa el `inviteToken` opaco del
 * invitado, NUNCA su id. Por ahora solo se prepara y se muestra: la invitación pública aún no lo lee.
 */
export function getGuestInvitationUrl(invitationSlug: string, inviteToken: string, env?: SiteUrlEnv): string {
  return `${getPublicInvitationUrl(invitationSlug, env)}?guest=${encodeURIComponent(inviteToken)}`;
}
