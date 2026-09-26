"use client";

import { ArrowRight, ChartColumn, House, LayoutGrid, Mail, Settings, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { SidebarItem, SidebarNav } from "@/components/layout/navigation";
import { Wordmark } from "@/components/layout/wordmark";
import { EmphasisText } from "@/components/ui/typography";
import { dashboardAssets } from "@/lib/dashboard/assets";
import { dashboardCopy } from "@/lib/dashboard/copy";
import { getActiveNavId, getDashboardNav, getEventRefFromPath, type DashboardNavIcon } from "@/lib/dashboard/navigation";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const icons: Record<DashboardNavIcon, ComponentType<{ strokeWidth?: number }>> = {
  events: House,
  templates: LayoutGrid,
  guests: Users,
  rsvp: ChartColumn,
  messages: Mail,
  settings: Settings,
};

/**
 * Barra lateral del panel (mockup 05, `--lu-sidebar-w` 256 px). `responsive`: en escritorio completa
 * (≥ 1024), en tablet un rail de íconos (los textos quedan para lectores de pantalla) y en móvil no se
 * muestra: vive en un cajón (`full`). El elemento activo sale de la ruta actual.
 */
export function DashboardSidebar({
  variant = "responsive",
  onNavigate,
  defaultEventId,
}: {
  variant?: "responsive" | "full";
  onNavigate?: () => void;
  /** Evento al que apuntan las secciones cuando la ruta no es de un evento; `null` = el usuario no tiene eventos. */
  defaultEventId?: string | null;
}) {
  const pathname = usePathname();
  const items = getDashboardNav(getEventRefFromPath(pathname) ?? defaultEventId);
  const activeId = getActiveNavId(pathname, items);
  const rail = variant === "responsive";

  return (
    <div className="flex h-full min-h-0 flex-col gap-8 px-4 py-6">
      <div className={cn("px-2", rail && "md:max-lg:px-0 md:max-lg:text-center")}>
        <Wordmark href={routes.home} className={cn(rail && "md:max-lg:hidden")} />
        {rail ? (
          <Link href={routes.home} aria-label="Ir al inicio" className="hidden rounded-lu-xs font-lu-display text-lu-title-lg text-lu-text outline-none focus-visible:ring-2 focus-visible:ring-lu-brown-600 md:max-lg:inline">
            L
          </Link>
        ) : null}
      </div>

      <SidebarNav label="Panel" className="gap-1.5">
        {items.map((item) => {
          const Icon = icons[item.id];
          return (
            <SidebarItem
              key={item.id}
              asChild
              active={item.id === activeId}
              icon={<Icon strokeWidth={1.5} />}
              className={cn("h-12 text-lu-md", rail && "md:max-lg:justify-center md:max-lg:px-0")}
            >
              <Link href={item.href} onClick={onNavigate} title={item.label}>
                <span className={cn(rail && "md:max-lg:sr-only")}>{item.label}</span>
              </Link>
            </SidebarItem>
          );
        })}
      </SidebarNav>

      <Link
        href={routes.templates}
        onClick={onNavigate}
        className={cn(
          "group relative mt-auto isolate flex min-h-56 flex-col justify-between overflow-hidden rounded-lu-card border border-lu-border-subtle bg-lu-surface-tint p-5 outline-none",
          "focus-visible:ring-2 focus-visible:ring-lu-brown-600 focus-visible:ring-offset-2 focus-visible:ring-offset-lu-canvas",
          rail && "md:max-lg:hidden",
        )}
      >
        <Image
          src={dashboardAssets.bouquet.src}
          alt=""
          width={dashboardAssets.bouquet.width}
          height={dashboardAssets.bouquet.height}
          sizes="224px"
          className="absolute inset-0 -z-10 size-full object-cover opacity-90"
        />
        <p className="max-w-[11em] self-start rounded-lu-image bg-lu-surface/80 px-3 py-2 font-lu-display text-lu-title-md leading-tight text-lu-text">
          <EmphasisText>{dashboardCopy.sidebarPromo.title}</EmphasisText>
        </p>
        <span className="inline-flex size-10 items-center justify-center self-start rounded-full border border-lu-border-subtle bg-lu-surface text-lu-text transition-transform duration-200 ease-lu-standard group-hover:translate-x-0.5">
          <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.75} />
          <span className="sr-only">{dashboardCopy.sidebarPromo.action}</span>
        </span>
      </Link>
    </div>
  );
}
