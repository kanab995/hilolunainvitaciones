import Link from "next/link";
import { Wordmark } from "@/components/layout/wordmark";
import { footerNav } from "@/lib/content/navigation";
import { routes } from "@/lib/routes";
import { siteConfig } from "@/lib/site-config";

/** Pie de las páginas públicas de marketing (mockup 01): filete, wordmark, enlaces y copyright. */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="lu-container pb-10">
      <div className="flex flex-col gap-6 border-t border-lu-divider pt-8 md:flex-row md:items-center md:gap-12">
        <Wordmark href={routes.home} />
        <nav aria-label="Pie de página">
          <ul className="flex flex-wrap gap-x-8 gap-y-2">
            {footerNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-lu-xs text-lu-sm text-lu-text-muted outline-none transition-colors hover:text-lu-text focus-visible:ring-2 focus-visible:ring-lu-brown-600 focus-visible:ring-offset-2 focus-visible:ring-offset-lu-canvas"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-lu-xs text-lu-text-subtle md:ml-auto">
          © {year} {siteConfig.name}. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
