"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavLink } from "@/components/layout/navigation";
import { isNavItemActive } from "@/lib/navigation";
import type { NavItem } from "@/types/marketing";

/**
 * Enlaces de la navbar de escritorio con el estado activo (subrayado tostado, mockup 02) calculado
 * a partir de la ruta. Es una isla cliente mínima: la cabecera sigue siendo un Server Component.
 */
export function SiteNavLinks({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();
  return items.map((item) => (
    <NavLink key={item.href} asChild active={isNavItemActive(item.href, pathname)}>
      <Link href={item.href}>{item.label}</Link>
    </NavLink>
  ));
}
