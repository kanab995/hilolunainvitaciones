import type { ReactNode } from "react";
import Link from "next/link";
import { Check, Clock, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ArrowBadge } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Numeral } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

export type StatusTone = "confirmed" | "pending" | "declined";

const tones: Record<StatusTone, { circle: string; icon: ReactNode }> = {
  confirmed: {
    circle: "bg-lu-success-bg",
    icon: <Check aria-hidden="true" strokeWidth={1.5} />,
  },
  pending: {
    circle: "bg-lu-pending-bg",
    icon: <Clock aria-hidden="true" strokeWidth={1.5} />,
  },
  declined: {
    circle: "bg-lu-declined-bg",
    icon: <X aria-hidden="true" strokeWidth={1.5} />,
  },
};

type StatusCardProps = {
  tone: StatusTone;
  value: number | string;
  /** "Confirmados" · "Pendientes" · "No asistirán". */
  label: string;
  /** Si se indica, toda la tarjeta es un enlace con flecha circular. */
  href?: string;
  /** Adorno decorativo a la derecha (fragmento floral del mockup 05). Va detrás del contenido. */
  decoration?: ReactNode;
  className?: string;
};

/**
 * TARJETA DE ESTADO (métricas de RSVP, mockup 05): círculo teñido según el estado, cifra en serif y
 * etiqueta. Confirmado = salvia · Pendiente = arena · No asistirá = blush. El estado nunca depende
 * solo del color: lleva ícono y texto. Es adaptable al ancho de su contenedor: por debajo de 16 rem
 * pasa a una versión compacta (círculo de 44 px y sin flecha) sin achicar la cifra.
 */
export function StatusCard({ tone, value, label, href, decoration, className }: StatusCardProps) {
  const { circle, icon } = tones[tone];

  const card = (
    <Card interactive={Boolean(href)} className={cn("group relative flex h-full items-center gap-3 overflow-hidden p-4 @[16rem]:gap-5 @[16rem]:px-(--lu-space-card) @[16rem]:py-3.5 @[28rem]:py-(--lu-space-card)", className)}>
      {decoration}
      <span
        className={cn(
          "relative inline-flex size-11 shrink-0 items-center justify-center rounded-full text-lu-text @[16rem]:size-16 [&_svg]:size-5 @[16rem]:[&_svg]:size-7",
          circle,
        )}
      >
        {icon}
      </span>
      <div className="relative flex min-w-0 flex-col gap-1">
        <Numeral>{value}</Numeral>
        <span className="font-lu-display text-lu-title-sm text-lu-text-secondary">{label}</span>
      </div>
      {href ? <ArrowBadge className={cn("relative ml-auto hidden @[16rem]:inline-flex", decoration && "@[22rem]:mr-16")} /> : null}
    </Card>
  );

  if (!href) return <div className="@container h-full">{card}</div>;

  return (
    <div className="@container h-full">
      <Link
        href={href}
        className="block h-full rounded-lu-card outline-none focus-visible:ring-2 focus-visible:ring-lu-brown-600 focus-visible:ring-offset-2 focus-visible:ring-offset-lu-canvas"
      >
        {card}
      </Link>
    </div>
  );
}

export function StatusCardSkeleton({ className }: { className?: string }) {
  return (
    <Card aria-hidden="true" className={cn("flex items-center gap-5", className)}>
      <Skeleton className="size-16 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-9 w-16" />
        <Skeleton className="h-4 w-24" />
      </div>
    </Card>
  );
}
