import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * «Agregar al calendario» (D-30): descarga el `.ics` de la versión PUBLICADA (`/i/[slug]/calendar.ics`). Es un enlace
 * normal (sin JavaScript, sin sesión, sin servicios de terceros); el archivo no contiene datos de invitados.
 */
export function CalendarActions({ calendarPath, className }: { calendarPath: string; className?: string }) {
  return (
    <div className={className}>
      <Button asChild variant="secondary">
        <a href={calendarPath} download data-calendar-download>
          <CalendarPlus aria-hidden="true" />
          Agregar al calendario
        </a>
      </Button>
      <p className="mt-2 text-lu-xs text-lu-text-muted">Descarga un archivo .ics con la fecha, la hora y el lugar publicados.</p>
    </div>
  );
}
