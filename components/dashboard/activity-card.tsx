import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

type ActivityCardProps = {
  title: string;
  /** Enlace de cabecera ("Ver toda la actividad"). */
  action?: { label: string; href: string };
  children: ReactNode;
  className?: string;
};

/** Tarjeta de "Actividad reciente" (mockup 05): cabecera + lista de filas separadas por filetes. */
export function ActivityCard({ title, action, children, className }: ActivityCardProps) {
  return (
    <Card padding="none" className={cn("overflow-hidden", className)}>
      <div className="flex items-baseline justify-between gap-4 px-6 pt-6 pb-3">
        <Heading as="h3" size="h3">
          {title}
        </Heading>
        {action ? (
          <Link
            href={action.href}
            className="inline-flex items-center gap-1.5 rounded-lu-xs text-lu-sm text-lu-text-secondary outline-none transition-colors hover:text-lu-text focus-visible:ring-2 focus-visible:ring-lu-brown-600"
          >
            {action.label}
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        ) : null}
      </div>
      <ul className="divide-y divide-lu-border-subtle px-6 pb-2">{children}</ul>
    </Card>
  );
}

type ActivityItemProps = {
  /** Nombre de la persona (se muestra en serif). */
  name: string;
  /** Resto de la frase: "confirmó asistencia". */
  action: string;
  /** Tiempo abreviado a la derecha ("2 h"). */
  time: string;
  /** Tiempo completo bajo el texto ("Hace 2 horas"). */
  detail?: string;
};

export function ActivityItem({ name, action, time, detail }: ActivityItemProps) {
  return (
    <li className="flex items-center gap-4 py-3.5">
      <Avatar name={name} />
      <div className="min-w-0 flex-1">
        <p className="text-lu-sm text-lu-text-secondary">
          <strong className="font-lu-display text-lu-title-sm font-semibold text-lu-text">{name}</strong> {action}
        </p>
        {detail ? <p className="text-lu-xs text-lu-text-subtle">{detail}</p> : null}
      </div>
      <span className="shrink-0 text-lu-xs text-lu-text-subtle">{time}</span>
    </li>
  );
}
