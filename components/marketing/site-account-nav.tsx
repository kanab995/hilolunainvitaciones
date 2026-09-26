"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavLink } from "@/components/layout/navigation";
import { AuthStateBoundary } from "@/components/marketing/auth-state";
import { Button } from "@/components/ui/button";
import { getAccountNavItem, getHeaderCta, type AuthNavState } from "@/lib/content/navigation";
import { isNavItemActive } from "@/lib/navigation";

/** Enlace de cuenta de la navbar de escritorio (presentación pura según el estado de la sesión). */
export function AccountNavLinkView({ state, pathname }: { state: AuthNavState; pathname: string | null }) {
  const item = getAccountNavItem(state);
  if (!item) {
    // Reserva el ancho del enlace mientras se resuelve la sesión (sin parpadeo ni salto de layout).
    return (
      <span aria-hidden="true" className="invisible">
        <NavLink asChild>
          <span>Entrar</span>
        </NavLink>
      </span>
    );
  }
  return (
    <NavLink asChild active={isNavItemActive(item.href, pathname)}>
      <Link href={item.href}>{item.label}</Link>
    </NavLink>
  );
}

export function AccountNavLink({ authEnabled }: { authEnabled: boolean }) {
  const pathname = usePathname();
  return <AuthStateBoundary enabled={authEnabled}>{(state) => <AccountNavLinkView state={state} pathname={pathname} />}</AuthStateBoundary>;
}

/** CTA "Crear invitación" de la navbar de escritorio. */
export function HeaderCta({ authEnabled }: { authEnabled: boolean }) {
  return (
    <AuthStateBoundary enabled={authEnabled}>
      {(state) => {
        const cta = getHeaderCta(state);
        return (
          <Button asChild shape="pill" arrow className="hidden md:inline-flex">
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
        );
      }}
    </AuthStateBoundary>
  );
}
