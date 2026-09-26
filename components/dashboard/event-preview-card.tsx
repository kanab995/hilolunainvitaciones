import Image from "next/image";
import { dashboardAssets } from "@/lib/dashboard/assets";
import { dashboardCopy } from "@/lib/dashboard/copy";
import { formatEventDate } from "@/lib/dashboard/format";
import type { EventDashboardData } from "@/types/dashboard";

/**
 * Tarjeta editorial del evento (mockup 05): fotografía aprobada de la mesa con una tarjeta de papel
 * encima: "NUESTRO EVENTO", los nombres, la fecha y el mensaje de cierre de la invitación
 * (`invitation.closing.message`), que es su única fuente.
 */
export function EventPreviewCard({ data }: { data: Pick<EventDashboardData, "event" | "invitation"> }) {
  const { event, invitation } = data;
  const { src, width, height } = dashboardAssets.eventTable;

  return (
    <section aria-label="Tu evento" className="relative isolate flex min-h-64 overflow-hidden rounded-lu-card border border-lu-border-subtle bg-lu-surface-tint shadow-lu-card lg:min-h-full">
      <Image src={src} alt="Mesa con velas y flores para el evento" width={width} height={height} sizes="(min-width: 1024px) 380px, 100vw" className="absolute inset-0 -z-10 size-full object-cover object-[50%_60%]" />
      <div className="relative m-4 ml-auto flex w-full max-w-64 flex-col justify-center gap-3 self-center rounded-lu-card border border-lu-border-subtle bg-lu-surface/95 p-6 sm:m-6">
        <p className="font-lu-sans text-lu-caps text-lu-eyebrow uppercase">{dashboardCopy.eventCard.eyebrow}</p>
        <p className="font-lu-display text-lu-title-lg leading-tight text-lu-brown-600 italic">{event.title}</p>
        <p className="font-lu-sans text-lu-xs tracking-[0.18em] text-lu-text-secondary uppercase">{formatEventDate(event.startsAt, event.timezone)}</p>
        <blockquote className="font-lu-display text-lu-title-sm leading-snug text-lu-text-secondary italic">“{invitation.closing.message}.”</blockquote>
      </div>
    </section>
  );
}
