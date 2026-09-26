import Link from "next/link";
import { DashboardPlaceholder } from "@/components/dashboard/dashboard-placeholder";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

/** Evento inexistente: mensaje claro dentro del panel (sin datos internos ni trazas). */
export default function EventNotFound() {
  return (
    <DashboardPlaceholder title="Evento no encontrado" description="No encontramos este evento. Puede que el enlace haya cambiado o que ya no exista.">
      <div>
        <Button asChild variant="secondary">
          <Link href={routes.events}>Volver a Mis eventos</Link>
        </Button>
      </div>
    </DashboardPlaceholder>
  );
}
