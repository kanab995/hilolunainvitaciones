import type { ReactNode } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ArrowBadge } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

type ShortcutCardProps = {
  /** Ícono de línea fina (lucide). */
  icon: ReactNode;
  title: string;
  description: string;
  /** Destino de la tarjeta. Alternativa: `onClick` (acción local, p. ej. abrir un modal). */
  href?: string;
  onClick?: () => void;
  /** Pie ilustrativo opcional (lista de invitados, gráfico, vista previa…). */
  children?: ReactNode;
  /** El pie contiene controles propios (botones): quedan por encima del enlace de la tarjeta. */
  interactiveFooter?: boolean;
  className?: string;
};

const titleControl =
  "min-w-0 flex-1 text-left leading-tight text-balance font-lu-display text-lu-title-sm text-lu-text outline-none " +
  "after:absolute after:inset-0 after:rounded-lu-card " +
  "focus-visible:after:ring-2 focus-visible:after:ring-lu-brown-600 focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-lu-canvas";

/**
 * TARJETA DE ATAJO del dashboard (mockup 05: "Editar invitación", "Invitados", "Confirmaciones",
 * "Compartir"): ícono en cuadrado suave + título serif + flecha circular, descripción y un pie.
 * Toda la tarjeta es clicable con el patrón de "enlace extendido": el título es el ÚNICO enlace (o
 * botón) y su `::after` cubre la tarjeta, así el pie puede tener controles propios sin anidar
 * elementos interactivos.
 */
export function ShortcutCard({ icon, title, description, href, onClick, children, interactiveFooter, className }: ShortcutCardProps) {
  return (
    <Card interactive className={cn("group relative flex h-full flex-col gap-4", className)}>
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lu-button bg-lu-surface-tint text-lu-text [&_svg]:size-5 [&_svg]:stroke-[1.5]"
        >
          {icon}
        </span>
        <h3 className="min-w-0 flex-1">
          {href ? (
            <Link href={href} className={cn(titleControl, "block")}>
              {title}
            </Link>
          ) : (
            <button type="button" onClick={onClick} className={cn(titleControl, "block w-full")}>
              {title}
            </button>
          )}
        </h3>
        <ArrowBadge />
      </div>
      <p className="text-lu-sm text-lu-text-secondary">{description}</p>
      {children ? <div className={cn("mt-auto pt-1", interactiveFooter && "pointer-events-none relative z-10 [&_a]:pointer-events-auto [&_button]:pointer-events-auto")}>{children}</div> : null}
    </Card>
  );
}
