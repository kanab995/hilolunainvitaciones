import type { MetadataRoute } from "next";
import { routes } from "@/lib/routes";
import { getSiteUrl } from "@/lib/site-url";
import { isStagingEnv } from "@/server/config/app-env";

/**
 * robots.txt. Indexables: solo el marketing (home, plantillas, precios, privacidad y términos). NO indexables ni rastreables: el panel, la consola,
 * la vista previa del editor, las invitaciones públicas (`/i/**`, que llevan el token del invitado en la URL), el acceso y la API. Las mismas
 * rutas responden además con `X-Robots-Tag: noindex` (server/security/csp.ts) por si un rastreador ya conoce la URL.
 * STAGING (`APP_ENV=staging`): se bloquea TODO el sitio y no se anuncia sitemap. Se genera al build: `APP_ENV` debe ser el mismo al construir.
 */
export default function robots(): MetadataRoute.Robots {
  if (isStagingEnv(process.env)) return { rules: [{ userAgent: "*", disallow: ["/"] }] };
  const base = getSiteUrl();
  return {
    rules: [{ userAgent: "*", allow: [routes.home, routes.templates, routes.pricing, routes.privacy, routes.terms], disallow: [routes.dashboard, routes.admin, "/preview", "/i/", "/api/", routes.signIn, routes.signUp] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
