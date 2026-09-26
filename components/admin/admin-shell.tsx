"use client";

import { ArrowLeft, CalendarDays, ClipboardList, Gauge, LayoutGrid, Menu, Receipt, Users, Webhook, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useState, type ComponentType, type ReactNode } from "react";
import { UserMenu } from "@/components/dashboard/user-menu";
import { SidebarItem, SidebarNav } from "@/components/layout/navigation";
import { Wordmark } from "@/components/layout/wordmark";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { adminCopy } from "@/lib/admin/copy";
import { adminNav, getActiveAdminNavId, type AdminNavId } from "@/lib/admin/navigation";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { DashboardUser } from "@/types/dashboard";

const icons: Record<AdminNavId, ComponentType<{ strokeWidth?: number }>> = {
  overview: Gauge,
  users: Users,
  events: CalendarDays,
  templates: LayoutGrid,
  purchases: Receipt,
  webhooks: Webhook,
  audit: ClipboardList,
};

/** Marca de la consola: «Hilo Luna» + etiqueta ADMIN (texto, no solo color). */
function AdminBrand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Wordmark size="sm" href={routes.admin} />
      <Badge tone="ink" size="sm" className="tracking-[0.12em]">
        {adminCopy.badge}
      </Badge>
    </div>
  );
}

/**
 * Barra lateral de la consola (D-33). ≥ 1024: completa (`--lu-sidebar-w`); 768–1023: rail de íconos (los textos quedan para lectores de
 * pantalla); < 768: vive en un cajón (`full`). Independiente de la barra del panel de clientes.
 */
function AdminSidebar({ variant = "responsive", onNavigate }: { variant?: "responsive" | "full"; onNavigate?: () => void }) {
  const activeId = getActiveAdminNavId(usePathname());
  const rail = variant === "responsive";
  return (
    <div className="flex h-full min-h-0 flex-col gap-6 px-4 py-5">
      <div className={cn("px-2", rail && "md:max-lg:px-0 md:max-lg:text-center")}>
        <AdminBrand className={cn(rail && "md:max-lg:hidden")} />
        {rail ? (
          <Link href={routes.admin} aria-label={adminCopy.consoleLabel} className="hidden rounded-lu-xs font-lu-display text-lu-title-lg text-lu-text outline-none focus-visible:ring-2 focus-visible:ring-lu-brown-600 md:max-lg:inline">
            L
          </Link>
        ) : null}
      </div>

      <SidebarNav label={adminCopy.navLabel} className="gap-1">
        {adminNav.map((item) => {
          const Icon = icons[item.id];
          return (
            <SidebarItem key={item.id} asChild active={item.id === activeId} icon={<Icon strokeWidth={1.5} />} className={cn("h-11 text-lu-base", rail && "md:max-lg:justify-center md:max-lg:px-0")}>
              <Link href={item.href} onClick={onNavigate} title={item.label}>
                <span className={cn(rail && "md:max-lg:sr-only")}>{item.label}</span>
              </Link>
            </SidebarItem>
          );
        })}
      </SidebarNav>

      <SidebarItem asChild icon={<ArrowLeft strokeWidth={1.5} />} className={cn("mt-auto h-11 text-lu-base", rail && "md:max-lg:justify-center md:max-lg:px-0")}>
        <Link href={routes.events} onClick={onNavigate} title={adminCopy.backToPanel}>
          <span className={cn(rail && "md:max-lg:sr-only")}>{adminCopy.backToPanel}</span>
        </Link>
      </SidebarItem>
    </div>
  );
}

/**
 * Marco de la consola interna (D-33): independiente del panel de clientes (otra barra, otra marca «ADMIN») pero con el mismo sistema de diseño
 * (tokens `--lu-*`; nunca `--inv-*`). Más denso que el panel: contenido de hasta 80 rem con márgenes menores. La autorización NO vive aquí:
 * la layout servidor y cada página llaman a `requireAdmin()`.
 */
export function AdminShell({ user, canSignOut, children }: { user: DashboardUser; canSignOut: boolean; children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div data-layout="admin" className="min-h-svh bg-lu-canvas md:grid md:grid-cols-[4.5rem_minmax(0,1fr)] lg:grid-cols-[var(--lu-sidebar-w)_minmax(0,1fr)]">
      <a href="#main" className="sr-only rounded-lu-button bg-lu-ink px-4 py-2 text-lu-sm text-lu-on-ink focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50">
        {adminCopy.skip}
      </a>

      <aside className="sticky top-0 hidden h-svh border-r border-lu-border-subtle bg-lu-surface-muted md:block">
        <AdminSidebar />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-lu-border-subtle bg-lu-canvas px-4 md:px-6 xl:px-8">
          <IconButton variant="ghost" size="lg" className="md:hidden" aria-label={adminCopy.openMenu} onClick={() => setDrawerOpen(true)}>
            <Menu aria-hidden="true" />
          </IconButton>
          <AdminBrand className="md:hidden" />
          <div className="ml-auto flex items-center gap-1 sm:gap-3">
            <UserMenu user={user} canSignOut={canSignOut} />
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-[80rem] flex-1 px-4 pt-5 pb-14 md:px-6 md:pt-8 md:pb-16 xl:px-8">
          {children}
        </main>
      </div>

      <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-lu-ink/40 md:hidden" />
          <DialogPrimitive.Content aria-describedby={undefined} className="fixed inset-y-0 left-0 z-50 w-[min(20rem,88vw)] border-r border-lu-border-subtle bg-lu-surface-muted shadow-lu-modal outline-none md:hidden">
            <DialogPrimitive.Title className="sr-only">{adminCopy.consoleLabel}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <IconButton variant="ghost" size="lg" className="absolute top-3 right-3" aria-label={adminCopy.closeMenu}>
                <X aria-hidden="true" />
              </IconButton>
            </DialogPrimitive.Close>
            <AdminSidebar variant="full" onNavigate={() => setDrawerOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
