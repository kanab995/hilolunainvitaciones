import type { MetadataRoute } from "next";
import { routes } from "@/lib/routes";
import { getSiteUrl } from "@/lib/site-url";
import { isStagingEnv } from "@/server/config/app-env";
import { getTemplates } from "@/server/repositories/templates";

/**
 * sitemap.xml SOLO de páginas públicas de marketing: home, plantillas (y su detalle), precios, privacidad y términos. NUNCA `/i/**` (invitaciones y
 * enlaces con token de invitado), `/dashboard/**`, `/admin/**` ni `/preview/**`. Las plantillas ocultas desde la consola no aparecen.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Staging: sitemap vacío (todo el sitio es noindex; ver app/robots.ts).
  if (isStagingEnv(process.env)) return [];
  const base = getSiteUrl();
  const templates = await getTemplates().catch(() => []);
  const staticPaths = [routes.home, routes.templates, routes.pricing, routes.privacy, routes.terms];
  return [...staticPaths.map((path) => ({ url: `${base}${path === "/" ? "" : path}` })), ...templates.map((template) => ({ url: `${base}${routes.template(template.slug)}` }))];
}
