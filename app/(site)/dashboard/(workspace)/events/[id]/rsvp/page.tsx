import type { Metadata } from "next";
import { DashboardPlaceholder } from "@/components/dashboard/dashboard-placeholder";
import { describeRsvpSummary, RsvpDonut } from "@/components/dashboard/rsvp-donut";
import { RsvpSummary } from "@/components/dashboard/rsvp-summary";
import { loadDashboardPage } from "@/lib/dashboard/load-dashboard";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Confirmaciones" };

/** Confirmaciones: por ahora el resumen que ya existe en el dashboard; el detalle llega con Guest Manager. */
export default async function EventRsvpPage(props: PageProps<"/dashboard/events/[id]/rsvp">) {
  const { id } = await props.params;
  const data = await loadDashboardPage(id, routes.eventRsvp);

  return (
    <DashboardPlaceholder
      title="Confirmaciones"
      description="Este es el resumen de respuestas de tu evento. El detalle por invitado se implementará en la siguiente fase."
      eventId={data.event.id}
      eventTitle={data.event.title}
    >
      <RsvpSummary summary={data.rsvpSummary} eventId={data.event.id} />
      <div className="flex items-center gap-5 rounded-lu-card border border-lu-border-subtle bg-lu-surface p-6 shadow-lu-card">
        <RsvpDonut summary={data.rsvpSummary} size={96} />
        <p className="text-lu-base text-lu-text-secondary">{describeRsvpSummary(data.rsvpSummary)}.</p>
      </div>
    </DashboardPlaceholder>
  );
}
