"use client";

import { Bell, ChevronDown, LogOut } from "lucide-react";
import Link from "next/link";
import { SignOutMenuItem } from "@/components/dashboard/sign-out-menu-item";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { adminCopy } from "@/lib/admin/copy";
import { billingCopy } from "@/lib/billing/copy";
import { routes } from "@/lib/routes";
import type { DashboardUser } from "@/types/dashboard";

/** Notificaciones: menú local sin datos (no hay notificaciones todavía). */
export function NotificationsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton variant="ghost" size="lg" aria-label="Notificaciones">
          <Bell aria-hidden="true" strokeWidth={1.5} />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-64">
        <DropdownMenuLabel>No tienes notificaciones nuevas.</DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Menú de la persona ("Andrea ⌄", mockup 05): la sesión real. Pocas opciones a propósito: "Mis eventos"
 * y "Cerrar sesión" (con Clerk; en el modo de demostración de desarrollo no hay sesión que cerrar). `isAdmin` (D-33) añade, solo para
 * administradores, un enlace discreto «Administración»: es cortesía de navegación, NO una barrera (`/admin/**` se protege en el servidor).
 */
export function UserMenu({ user, canSignOut, isAdmin = false }: { user: DashboardUser; canSignOut: boolean; isAdmin?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-lu-pill py-1 pr-2 pl-1 text-lu-base text-lu-text outline-none transition-colors hover:bg-lu-selected focus-visible:ring-2 focus-visible:ring-lu-brown-600">
        <Avatar name={user.name} size="sm" />
        <span className="max-sm:sr-only">{user.name}</span>
        <ChevronDown aria-hidden="true" className="size-4 text-lu-text-muted" strokeWidth={1.5} />
        <span className="sr-only">Menú de {user.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem asChild>
          <Link href={routes.events}>Mis eventos</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={routes.billing}>{billingCopy.menu.billing}</Link>
        </DropdownMenuItem>
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href={routes.admin}>{adminCopy.menuLink}</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        {canSignOut ? (
          <SignOutMenuItem />
        ) : (
          <DropdownMenuItem disabled>
            <LogOut aria-hidden="true" />
            Cerrar sesión (modo demostración)
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
