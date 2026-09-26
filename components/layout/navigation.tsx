import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * NAVEGACIÓN del producto. Componentes de presentación puros: el estado activo llega por
 * props (`active`), no se calcula aquí, para poder usarse en Server Components.
 */

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-lu-brown-600 focus-visible:ring-offset-2 focus-visible:ring-offset-lu-canvas";

/* ───────── Navbar de marketing (mockups 01–03) ───────── */

type NavLinkProps = ComponentProps<"a"> & { active?: boolean; asChild?: boolean };

/** Enlace de la barra superior. Activo: texto pleno + subrayado tostado (mockup 02). */
export function NavLink({ active = false, asChild = false, className, ...props }: NavLinkProps) {
  const Comp = asChild ? Slot.Root : "a";
  return (
    <Comp
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative inline-flex h-10 items-center rounded-lu-xs font-lu-sans text-lu-base transition-colors duration-150 ease-lu-standard",
        "after:absolute after:inset-x-0 after:bottom-1 after:h-0.5 after:bg-lu-brown-400 after:transition-opacity after:duration-150",
        active
          ? "text-lu-text after:opacity-100"
          : "text-lu-text-secondary after:opacity-0 hover:text-lu-text",
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

type NavBarProps = {
  brand: ReactNode;
  /** <NavLink>… (se ocultan bajo `md`; el menú móvil no tiene mockup, Q-13). */
  links?: ReactNode;
  /** Botón/es de la derecha (p. ej. "Crear invitación →"). */
  actions?: ReactNode;
  className?: string;
};

export function NavBar({ brand, links, actions, className }: NavBarProps) {
  return (
    <header className={cn("lu-container relative flex h-(--lu-header-h) items-center gap-6", className)}>
      {brand}
      {links ? (
        <nav aria-label="Principal" className="ml-4 hidden items-center gap-6 md:flex lg:ml-16 lg:gap-10 xl:ml-24">
          {links}
        </nav>
      ) : null}
      <div className="ml-auto flex items-center gap-3">{actions}</div>
    </header>
  );
}

/* ───────── Sidebar del dashboard (mockup 05) ───────── */

export function SidebarNav({
  label,
  className,
  ...props
}: ComponentProps<"nav"> & { label: string }) {
  return <nav aria-label={label} className={cn("flex flex-col gap-1", className)} {...props} />;
}

type SidebarItemProps = ComponentProps<"a"> & {
  active?: boolean;
  icon?: ReactNode;
  asChild?: boolean;
};

/** Fila del sidebar: ícono de línea fina + etiqueta; activa = fondo `--lu-nav-active`. */
export function SidebarItem({
  active = false,
  icon,
  asChild = false,
  className,
  children,
  ...props
}: SidebarItemProps) {
  const Comp = asChild ? Slot.Root : "a";
  return (
    <Comp
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-11 items-center gap-3 rounded-lu-input px-3 font-lu-sans text-lu-ui transition-colors duration-150 ease-lu-standard",
        "[&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:stroke-[1.5]",
        active
          ? "bg-lu-nav-active font-medium text-lu-text"
          : "text-lu-text-secondary hover:bg-lu-selected hover:text-lu-text",
        focusRing,
        className,
      )}
      {...props}
    >
      {icon}
      <Slot.Slottable>{children}</Slot.Slottable>
    </Comp>
  );
}

/* ───────── Migas de pan (mockups 03, 04, 05) ───────── */

type Crumb = { label: string; href?: string };

export function Breadcrumbs({
  items,
  separator = "chevron",
  className,
}: {
  items: Crumb[];
  /** [03]/[05] usan `›`; [04] usa `/`. */
  separator?: "chevron" | "slash";
  className?: string;
}) {
  return (
    <nav aria-label="Migas de pan" className={className}>
      <ol className="flex flex-wrap items-center gap-2 font-lu-sans text-lu-sm text-lu-text-muted">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className={cn("rounded-lu-xs transition-colors hover:text-lu-text", focusRing)}
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined} className={isLast ? "text-lu-text" : undefined}>
                  {item.label}
                </span>
              )}
              {isLast ? null : separator === "chevron" ? (
                <ChevronRight aria-hidden="true" className="size-3.5 text-lu-text-subtle" />
              ) : (
                <span aria-hidden="true" className="text-lu-text-subtle">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
