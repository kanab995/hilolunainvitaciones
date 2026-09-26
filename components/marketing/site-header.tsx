import { MobileMenu } from "@/components/marketing/mobile-menu";
import { AccountNavLink, HeaderCta } from "@/components/marketing/site-account-nav";
import { SiteNavLinks } from "@/components/marketing/site-nav-links";
import { NavBar } from "@/components/layout/navigation";
import { Wordmark } from "@/components/layout/wordmark";
import { mainNav } from "@/lib/content/navigation";
import { routes } from "@/lib/routes";
import { isClerkConfigured } from "@/server/auth/mode";

/**
 * Cabecera de las páginas públicas de marketing. Transparente (el hero pasa por debajo), dentro
 * de `lu-container`. Escritorio: wordmark · enlaces · CTA con forma de píldora (excepción de
 * DESIGN_SYSTEM §3.3). Móvil: wordmark + botón de menú.
 * El enlace activo (`Plantillas` en `/templates`) lo marca `SiteNavLinks` según la ruta.
 */
export function SiteHeader() {
  // La sesión de la persona la resuelve Clerk en el cliente (las páginas públicas siguen siendo estáticas).
  const authEnabled = isClerkConfigured();
  return (
    <div className="relative z-20">
      <a
        href="#main"
        className="sr-only rounded-lu-button bg-lu-ink px-4 py-2 text-lu-sm text-lu-on-ink focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Saltar al contenido
      </a>
      <NavBar
        brand={<Wordmark href={routes.home} />}
        links={
          <>
            <SiteNavLinks items={mainNav} />
            <AccountNavLink authEnabled={authEnabled} />
          </>
        }
        actions={
          <>
            <HeaderCta authEnabled={authEnabled} />
            <MobileMenu items={mainNav} authEnabled={authEnabled} />
          </>
        }
      />
    </div>
  );
}
