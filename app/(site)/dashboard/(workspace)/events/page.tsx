import type { Metadata } from "next";
import Link from "next/link";
import { DashboardPlaceholder } from "@/components/dashboard/dashboard-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heading, Text } from "@/components/ui/typography";
import { formatEventDate } from "@/lib/dashboard/format";
import { publicationLabels } from "@/lib/publishing/state";
import { publishCopy } from "@/lib/publishing/copy";
import { routes } from "@/lib/routes";
import { requireAuth } from "@/server/auth/current-user";
import { listOwnedEvents, type OwnedEventListItem } from "@/server/repositories/events";

export const metadata: Metadata = { title: "Mis eventos" };

/** La lista depende de la sesión y de la base de datos: nunca se prerenderiza en el build. */
export const dynamic = "force-dynamic";

/** Estado de publicación (D-29) → aspecto de la insignia. Los textos salen de `publicationLabels`. */
const statusTone: Record<OwnedEventListItem["publication"]["state"], "neutral" | "success" | "pending"> = { draft: "pending", published: "success", changes: "pending" };

/** "Mis eventos": solo los eventos del usuario con sesión. Sin eventos, estado vacío con el siguiente paso. */
export default async function EventsPage() {
  const user = await requireAuth();
  const events = await listOwnedEvents(user.id);

  return (
    <DashboardPlaceholder title="Mis eventos" description={events.length > 0 ? "Aquí están tus eventos. Ábrelos para gestionarlos o edita su invitación." : "Cuando crees tu primera invitación, aparecerá aquí."}>
      {events.length === 0 ? (
        <section aria-labelledby="empty-events" className="flex flex-col items-start gap-4 rounded-lu-card border border-lu-border-subtle bg-lu-surface p-6 shadow-lu-card md:p-8">
          <Heading as="h2" id="empty-events" size="title-lg">
            Aún no tienes eventos
          </Heading>
          <Text size="base" className="max-w-prose">
            Elige una plantilla y empieza a diseñar la invitación de tu próximo evento.
          </Text>
          <Button asChild size="lg" arrow>
            <Link href={routes.templates}>Crear mi primera invitación</Link>
          </Button>
        </section>
      ) : (
        <ul className="flex flex-col gap-4">
          {events.map((event) => {
            const state = event.publication.state;
            return (
              <li key={event.id} className="flex flex-col gap-4 rounded-lu-card border border-lu-border-subtle bg-lu-surface p-6 shadow-lu-card sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <p className="font-lu-display text-lu-title-lg text-lu-text">{event.title}</p>
                  <p className="text-lu-sm text-lu-text-muted">
                    {formatEventDate(event.startsAt, event.timezone)} · Plantilla {event.templateName}
                  </p>
                  <Badge tone={statusTone[state]} data-publication-state={state} className="mt-1 self-start">
                    {publicationLabels[state]}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-3">
                  {/* CTA contextual: Borrador → Continuar editando · Publicado → Abrir invitación · Cambios → Publicar cambios */}
                  {state === "published" ? (
                    <Button asChild>
                      <a href={routes.invitation(event.publicSlug)} target="_blank" rel="noopener noreferrer">
                        {publishCopy.list.published}
                        <span className="sr-only"> (se abre en una pestaña nueva)</span>
                      </a>
                    </Button>
                  ) : (
                    <Button asChild>
                      <Link href={routes.eventEdit(event.id)}>{state === "changes" ? publishCopy.list.changes : publishCopy.list.draft}</Link>
                    </Button>
                  )}
                  <Button asChild variant="secondary">
                    <Link href={routes.event(event.id)}>Ver evento</Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardPlaceholder>
  );
}
