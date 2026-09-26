"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { AuthStateBoundary } from "@/components/marketing/auth-state";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { getAccountNavItem, getHeaderCta } from "@/lib/content/navigation";
import { isNavItemActive } from "@/lib/navigation";
import type { NavItem } from "@/types/marketing";

/**
 * Menú móvil de la navbar (patrón "disclosure"): un botón real con `aria-expanded` que muestra un
 * panel de enlaces. Se cierra con Escape (devolviendo el foco al botón) o al elegir un enlace.
 * Visible solo bajo `md`; el panel se posiciona respecto de la navbar (`relative`).
 */
export function MobileMenu({ items, authEnabled }: { items: readonly NavItem[]; authEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <IconButton
        ref={buttonRef}
        size="lg"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </IconButton>

      <nav
        id={panelId}
        aria-label="Menú"
        hidden={!open}
        className="absolute inset-x-(--lu-gutter) top-full z-30 mt-1 flex flex-col gap-1 rounded-lu-card border border-lu-border-subtle bg-lu-surface p-3 shadow-lu-float animate-in fade-in-0 slide-in-from-top-1 duration-150"
      >
        <AuthStateBoundary enabled={authEnabled}>
          {(state) => {
            const account = getAccountNavItem(state);
            const cta = getHeaderCta(state);
            return (
              <>
                {[...items, ...(account ? [account] : [])].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={close}
                    aria-current={isNavItemActive(item.href, pathname) ? "page" : undefined}
                    className="flex h-12 items-center rounded-lu-input px-3 text-lu-md text-lu-text outline-none transition-colors hover:bg-lu-selected focus-visible:ring-2 focus-visible:ring-lu-brown-600"
                  >
                    {item.label}
                  </Link>
                ))}
                <Button asChild size="lg" shape="pill" arrow fullWidth className="mt-2">
                  <Link href={cta.href} onClick={close}>
                    {cta.label}
                  </Link>
                </Button>
              </>
            );
          }}
        </AuthStateBoundary>
      </nav>
    </div>
  );
}
