import { CalendarDays, Clock, Pencil } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ShareButton } from "@/components/dashboard/share-dialog";
import { Breadcrumbs } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heading } from "@/components/ui/typography";
import { publicationLabels } from "@/lib/publishing/state";
import { formatDaysLeft, formatEventDate } from "@/lib/dashboard/format";
import { routes } from "@/lib/routes";
import type { DashboardEvent } from "@/types/dashboard";

/**
 * Encabezado del evento (mockup 05): migas, título grande, fecha y «Faltan X días», y a la derecha las
 * acciones principales. La fecha y los días restantes se calculan desde `event.startsAt` (con la hora
 * del servidor `now`): no hay cifras escritas a mano.
 */
export function EventHeader({ event, now, planBadge, upgradeAction }: { event: DashboardEvent; now: number; /** Plan de ESTE evento (D-32), discreto junto al estado de publicación. */ planBadge?: ReactNode; /** Botón «Mejorar evento» (abre el panel de compra de este evento). */ upgradeAction?: ReactNode }) {
  const daysLeft = formatDaysLeft(event.startsAt, now);

  return (
    <header className="flex flex-col gap-5 md:gap-6">
      <Breadcrumbs items={[{ label: "Mis eventos", href: routes.events }, { label: event.title }]} />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="flex min-w-0 flex-col gap-2.5 md:gap-3">
          <Heading as="h1" size="display-md" className="leading-[1.1] text-balance">
            {event.title}
          </Heading>
          <div className="flex flex-wrap items-center gap-2">
            <Badge data-publication-state={event.publication.state} tone={event.publication.state === "published" ? "success" : "pending"} className="self-start">
              {publicationLabels[event.publication.state]}
            </Badge>
            {planBadge}
          </div>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 font-lu-display text-lu-title-md text-lu-text-secondary [font-variant-numeric:lining-nums]">
            <li className="flex items-center gap-2.5">
              <CalendarDays aria-hidden="true" className="size-5 text-lu-text-muted" strokeWidth={1.5} />
              <time dateTime={event.startsAt}>{formatEventDate(event.startsAt, event.timezone)}</time>
            </li>
            <li aria-hidden="true" className="hidden h-5 w-px bg-lu-border sm:block" />
            <li className="flex items-center gap-2.5">
              <Clock aria-hidden="true" className="size-5 text-lu-text-muted" strokeWidth={1.5} />
              <span data-days-left={daysLeft.days}>{daysLeft.label}</span>
            </li>
          </ul>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3 sm:flex sm:shrink-0">
          <Button asChild size="lg" className="max-sm:px-3">
            <Link href={routes.eventEdit(event.id)}>
              <Pencil aria-hidden="true" />
              Editar invitación
            </Link>
          </Button>
          <ShareButton className="max-sm:px-3" />
          {upgradeAction}
        </div>
      </div>
    </header>
  );
}
