/**
 * Única fuente de la marca y de los metadatos globales de Hilo Luna (nombre, dominio, URL canónica).
 * Nunca hardcodear el nombre ni el dominio fuera de aquí (ni en componentes ni en copy suelto). Para
 * construir URLs usa `lib/site-url.ts`, que funciona también en localhost.
 * "Lunaria" fue el nombre provisional anterior: ya no aparece en la interfaz.
 */
export const siteConfig = {
  name: "Hilo Luna",
  shortName: "Hilo Luna",
  /** Descripción global (metadatos). */
  description: "Crea invitaciones digitales personalizadas para bodas, XV años, bautizos, cumpleaños y momentos especiales.",
  locale: "es-MX",
  /** Dominio oficial de producción. */
  domain: "hiloluna.com",
  /** URL canónica de producción (la base real se calcula con `getSiteUrl()`). */
  url: "https://hiloluna.com",
  /** Correo de soporte; `null` hasta que exista. */
  supportEmail: null as string | null,
} as const;

export type SiteConfig = typeof siteConfig;
