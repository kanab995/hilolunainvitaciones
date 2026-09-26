import { cn } from "@/lib/utils";
import type { RsvpSummary } from "@/types/dashboard";

const segments = [
  { key: "confirmed", label: "confirmados", stroke: "stroke-lu-success" },
  { key: "pending", label: "pendientes", stroke: "stroke-lu-pending" },
  { key: "declined", label: "no asistirán", stroke: "stroke-lu-blush" },
] as const;

/** Frase que describe el gráfico completo (equivalente textual). */
export function describeRsvpSummary(summary: RsvpSummary): string {
  const total = summary.confirmed + summary.pending + summary.declined;
  const one = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;
  return `${one(summary.confirmed, "confirmado", "confirmados")}, ${one(summary.pending, "pendiente", "pendientes")} y ${one(summary.declined, "no asistirá", "no asistirán")}, de ${one(total, "invitado", "invitados")}`;
}

/**
 * Gráfico de dona en SVG propio (sin librerías; docs/ANIMATIONS.md: sin animar). Es una ayuda visual:
 * los datos SIEMPRE están también como texto (`describeRsvpSummary` en el `aria-label` y, junto al
 * gráfico, las cifras). Colores del sistema: salvia, arena y blush.
 */
export function RsvpDonut({ summary, size = 88, className }: { summary: RsvpSummary; size?: number; className?: string }) {
  const total = summary.confirmed + summary.pending + summary.declined;
  let offset = 0;

  return (
    <svg role="img" aria-label={describeRsvpSummary(summary)} viewBox="0 0 100 100" width={size} height={size} className={cn("shrink-0 -rotate-90", className)}>
      <circle cx="50" cy="50" r="38" fill="none" strokeWidth="16" className="stroke-lu-surface-tint" />
      {total > 0
        ? segments.map(({ key, stroke }) => {
            const share = (summary[key] / total) * 100;
            const circle = (
              <circle
                key={key}
                cx="50"
                cy="50"
                r="38"
                fill="none"
                strokeWidth="16"
                pathLength="100"
                strokeDasharray={`${Math.max(0, share - 0.8)} ${100 - Math.max(0, share - 0.8)}`}
                strokeDashoffset={-offset}
                className={stroke}
              />
            );
            offset += share;
            return circle;
          })
        : null}
    </svg>
  );
}
