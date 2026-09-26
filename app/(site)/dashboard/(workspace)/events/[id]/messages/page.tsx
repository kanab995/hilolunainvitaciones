import type { Metadata } from "next";
import { DashboardPlaceholder } from "@/components/dashboard/dashboard-placeholder";
import { loadDashboardPage } from "@/lib/dashboard/load-dashboard";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Mensajes" };

export default async function EventMessagesPage(props: PageProps<"/dashboard/events/[id]/messages">) {
  const { id } = await props.params;
  const data = await loadDashboardPage(id, routes.eventMessages);

  return (
    <DashboardPlaceholder
      title="Mensajes"
      description="Los mensajes y recordatorios para tus invitados se implementarán en una fase posterior."
      eventId={data.event.id}
      eventTitle={data.event.title}
    />
  );
}
