import { FloralCorner } from "@/components/dashboard/floral-corner";
import { StatusCard, type StatusTone } from "@/components/dashboard/status-card";
import { dashboardCopy } from "@/lib/dashboard/copy";
import { routes } from "@/lib/routes";
import type { RsvpSummary as RsvpSummaryData } from "@/types/dashboard";

const cards: readonly { tone: StatusTone; key: keyof RsvpSummaryData; corner: "tr" | "br" | "tl" }[] = [
  { tone: "confirmed", key: "confirmed", corner: "tr" },
  { tone: "pending", key: "pending", corner: "br" },
  { tone: "declined", key: "declined", corner: "tr" },
];

/**
 * Resumen de confirmaciones (mockup 05): tres tarjetas —Confirmados, Pendientes, No asistirán—. Las
 * cifras vienen de `EventDashboardData.rsvpSummary`, no del JSX. Cada tarjeta enlaza a Confirmaciones.
 * "Tal vez" cuenta como pendiente (decisión 8 de CLAUDE.md).
 */
export function RsvpSummary({ summary, eventId }: { summary: RsvpSummaryData; eventId: string }) {
  return (
    <section aria-label="Resumen de confirmaciones">
      <ul className="grid gap-4 md:grid-cols-3">
        {cards.map(({ tone, key, corner }) => (
          <li key={key} className="h-full">
            <StatusCard
              tone={tone}
              value={summary[key]}
              label={dashboardCopy.rsvp[key]}
              href={routes.eventRsvp(eventId)}
              decoration={<FloralCorner corner={corner} className="top-0 right-0 hidden size-24 opacity-90 @[22rem]:block" />}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
