"use client";

import { Menu, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useState, type ReactNode } from "react";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { NotificationsMenu, UserMenu } from "@/components/dashboard/user-menu";
import { Wordmark } from "@/components/layout/wordmark";
import { IconButton } from "@/components/ui/icon-button";
import { routes } from "@/lib/routes";
import type { DashboardUser } from "@/types/dashboard";

/**
 * Estructura del panel (mockup 05): barra lateral + barra superior + contenido.
 *  - ≥ 1024: barra lateral fija de 256 px (`--lu-sidebar-w`).
 *  - 768–1023: rail de íconos.
 *  - < 768: sin barra lateral; el botón de menú abre un cajón.
 * El contenido (`children`, Server Components) se coloca en `<main id="main">`, con 40 px de margen en
 * escritorio y un ancho máximo equilibrado.
 */
export function DashboardShell({ user, canSignOut, defaultEventId, isAdmin = false, children }: { user: DashboardUser; canSignOut: boolean; defaultEventId?: string | null; isAdmin?: boolean; children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div data-layout="workspace" className="min-h-svh bg-lu-canvas md:grid md:grid-cols-[4.5rem_minmax(0,1fr)] lg:grid-cols-[var(--lu-sidebar-w)_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only rounded-lu-button bg-lu-ink px-4 py-2 text-lu-sm text-lu-on-ink focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Saltar al contenido
      </a>

      <aside className="sticky top-0 hidden h-svh border-r border-lu-border-subtle bg-lu-surface-muted md:block">
        <DashboardSidebar defaultEventId={defaultEventId} />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-lu-border-subtle bg-lu-canvas px-4 md:px-6 xl:px-10">
          <IconButton variant="ghost" size="lg" className="md:hidden" aria-label="Abrir menú" onClick={() => setDrawerOpen(true)}>
            <Menu aria-hidden="true" />
          </IconButton>
          <Wordmark size="sm" href={routes.home} className="md:hidden" />
          <div className="ml-auto flex items-center gap-1 sm:gap-3">
            <NotificationsMenu />
            <UserMenu user={user} canSignOut={canSignOut} isAdmin={isAdmin} />
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-[75rem] flex-1 px-4 pt-5 pb-14 md:px-6 md:pt-10 md:pb-16 xl:px-10">
          {children}
        </main>
      </div>

      <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-lu-ink/40 md:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 w-[min(20rem,88vw)] border-r border-lu-border-subtle bg-lu-surface-muted shadow-lu-modal outline-none md:hidden"
          >
            <DialogPrimitive.Title className="sr-only">Menú del panel</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <IconButton variant="ghost" size="lg" className="absolute top-3 right-3" aria-label="Cerrar menú">
                <X aria-hidden="true" />
              </IconButton>
            </DialogPrimitive.Close>
            <DashboardSidebar variant="full" onNavigate={() => setDrawerOpen(false)} defaultEventId={defaultEventId} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
