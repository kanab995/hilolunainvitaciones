import Image from "next/image";
import { MiniInvitationCard } from "@/components/dashboard/mini-invitation-card";
import { EmphasisText, Heading, Text } from "@/components/ui/typography";
import { dashboardAssets } from "@/lib/dashboard/assets";
import { dashboardCopy } from "@/lib/dashboard/copy";
import { formatEventDate } from "@/lib/dashboard/format";
import { displayNames } from "@/lib/invitation/format";
import type { EventDashboardData } from "@/types/dashboard";

/**
 * Banner del evento (mockup 05): una sola composición editorial. La fotografía aprobada de portada
 * ocupa el lado derecho y se desvanece hacia el fondo del banner (máscara de la propia imagen), de modo
 * que el texto queda sobre el mismo fondo; la mini tarjeta con los datos del evento la cruza y se
 * recorta por abajo. En móvil solo queda el fondo suave (sin tarjeta) para priorizar el texto. No
 * renderiza la invitación (rendimiento).
 */
export function EventBanner({ data }: { data: Pick<EventDashboardData, "event" | "invitation"> }) {
  const { event, invitation } = data;
  const { src, width, height } = dashboardAssets.coverBackdrop;
  const dateLabel = formatEventDate(event.startsAt, event.timezone).toUpperCase().split(" ").join(" · ");

  return (
    <section aria-labelledby="banner-title" className="relative isolate overflow-hidden rounded-lu-banner border border-lu-border-subtle bg-lu-section-band">
      <Image
        src={src}
        alt=""
        width={width}
        height={height}
        sizes="(min-width: 1280px) 700px, (min-width: 768px) 60vw, 70vw"
        priority
        className="absolute inset-y-0 right-0 -z-10 h-full w-[70%] object-cover object-[50%_35%] opacity-60 lu-fade-left md:w-[62%] md:opacity-100"
      />
      <MiniInvitationCard
        eyebrow={invitation.cover.eyebrow}
        names={displayNames(invitation.names)}
        dateLabel={dateLabel}
        className="absolute top-6 right-[7%] hidden md:flex lg:right-[9%]"
      />

      <div className="relative z-10 flex flex-col justify-center gap-2.5 px-5 py-6 md:min-h-60 md:max-w-[58%] md:gap-3 md:px-10 md:py-10">
        <Heading as="h2" id="banner-title" size="h2" className="max-w-[12em] text-lu-title-lg leading-[1.1] md:text-lu-h2">
          <EmphasisText>{dashboardCopy.banner.title}</EmphasisText>
        </Heading>
        <Text size="base" tone="muted" className="max-w-sm max-md:text-lu-sm">
          {dashboardCopy.banner.description}
        </Text>
      </div>
    </section>
  );
}
