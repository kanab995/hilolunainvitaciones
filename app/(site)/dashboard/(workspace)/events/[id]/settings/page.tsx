import type { Metadata } from "next";
import { DashboardPlaceholder } from "@/components/dashboard/dashboard-placeholder";
import { loadDashboardPage } from "@/lib/dashboard/load-dashboard";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Configuración" };

export default async function EventSettingsPage(props: PageProps<"/dashboard/events/[id]/settings">) {
  const { id } = await props.params;
  const data = await loadDashboardPage(id, routes.eventSettings);

  return (
    <DashboardPlaceholder
      title="Configuración"
      description="Aquí podrás ajustar los datos generales del evento, la privacidad y el enlace público. Se implementará en una fase posterior."
      eventId={data.event.id}
      eventTitle={data.event.title}
    />
  );
}
