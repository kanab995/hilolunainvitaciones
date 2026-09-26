import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/layout/navigation";
import { Heading, Text } from "@/components/ui/typography";
import { routes } from "@/lib/routes";

/**
 * Marcador coherente para las secciones del panel que se implementan en fases posteriores: usa el
 * mismo marco, migas y tipografía que el dashboard, con un texto honesto y, opcionalmente, contenido
 * ya existente (`children`). Evita 404 desde la navegación visible sin inventar pantallas.
 */
export function DashboardPlaceholder({
  title,
  description,
  eventTitle,
  eventId,
  children,
}: {
  title: string;
  description: string;
  /** Si se indica, las migas incluyen el evento: Mis eventos › Evento › Sección. */
  eventTitle?: string;
  eventId?: string;
  children?: ReactNode;
}) {
  const crumbs = eventTitle && eventId
    ? [{ label: "Mis eventos", href: routes.events }, { label: eventTitle, href: routes.event(eventId) }, { label: title }]
    : [{ label: "Mis eventos", href: routes.events }, { label: title }];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <Breadcrumbs items={crumbs} />
        <Heading as="h1" size="display-md">
          {title}
        </Heading>
        <Text size="md" className="max-w-prose">
          {description}
        </Text>
      </header>
      {children}
    </div>
  );
}
