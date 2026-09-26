import { Calendar, MapPin, Music, Users } from "lucide-react";
import type { ReactNode } from "react";
import { FloatingBadge } from "@/components/marketing/floating-badge";
import { PhoneFrame } from "@/components/marketing/phone-frame";
import { CoverScreen } from "@/components/templates/preview-screens";
import { SceneBlobs } from "@/components/ui/media-slot";
import { heroBadges, heroInvitationDemo } from "@/lib/content/home";
import type { HeroBadgeData } from "@/types/marketing";

const badgeIcons: Record<HeroBadgeData["id"], ReactNode> = {
  countdown: <Calendar />,
  rsvp: <Users />,
  music: <Music />,
  location: <MapPin />,
};

/**
 * Posición de cada tarjeta alrededor del teléfono. Tablet/escritorio (`sm` en adelante): dos a cada
 * lado, rozando el bisel sin cubrir el texto de la invitación (en `lg` RSVP y Ubicación se acercan
 * al dispositivo). Móvil (< 640): solo Cuenta regresiva y Ubicación, sobre las zonas de decoración
 * superior/inferior del teléfono (nunca sobre el texto de la invitación ni la muesca).
 */
const badgePosition: Record<HeroBadgeData["id"], string> = {
  countdown: "left-0 top-[9%] sm:top-[12%] sm:left-[3%] lg:top-[9%]",
  rsvp: "right-0 top-[17%] hidden sm:flex sm:right-[1%] lg:top-[14%] lg:right-[2.5%]",
  music: "left-0 top-[63%] hidden sm:flex sm:left-[1%] lg:top-[60%]",
  location: "right-0 bottom-[6%] sm:bottom-auto sm:top-[52%] sm:right-[3%] lg:top-[49%] lg:right-[4.5%]",
};

/**
 * Composición visual del hero: teléfono con la invitación de demostración, tarjetas flotantes,
 * halo de luz y pedestal difuso (el teléfono queda integrado en una escena, no flotando).
 * Decorativa (aria-hidden): el mensaje ya está en el texto del hero.
 * TODO(asset): replace with approved Hilo Luna asset — la escena floral y la piedra que rodean al
 * teléfono (hoy son manchas difusas hechas con tokens).
 */
export function HeroVisual() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto h-[30rem] w-full max-w-[40rem] sm:h-[36rem] lg:ml-auto lg:h-[35.5rem]"
    >
      <SceneBlobs scene="petals" className="-inset-x-4 inset-y-0 lg:-inset-x-10" />
      <span className="absolute bottom-[2%] left-1/2 h-20 w-[64%] -translate-x-1/2 rounded-[50%] bg-lu-brown-400/20 blur-2xl" />

      {/* Móvil: escala 0,85 (−15 %) para que el teléfono se vea completo y con aire lateral;
          lg: anclado arriba (≈ 24 px más alto que centrado). */}
      <PhoneFrame className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-[0.85] sm:scale-100 lg:top-2 lg:translate-y-0">
        <CoverScreen sample={heroInvitationDemo} />
      </PhoneFrame>

      {heroBadges.map((badge) => (
        <FloatingBadge
          key={badge.id}
          icon={badgeIcons[badge.id]}
          title={badge.title}
          subtitle={badge.subtitle}
          className={`absolute ${badgePosition[badge.id]}`}
        />
      ))}
    </div>
  );
}
