import { Calendar, MapPin, Music, Users } from "lucide-react";
import type { ReactNode } from "react";
import { FloatingBadge } from "@/components/marketing/floating-badge";
import { PhoneFrame } from "@/components/marketing/phone-frame";
import { TemplateThumbCard } from "@/components/marketing/template-thumb-card";
import { CoverScreen } from "@/components/templates/preview-screens";
import { heroBadges, heroInvitationDemo } from "@/lib/content/home";
import { getTemplateCoverImage } from "@/lib/templates/status";
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
 * Composición visual del hero: un teléfono principal con la invitación de Magnolia (portada real,
 * `getTemplateCoverImage` — su imagen tiene el centro despejado para texto a propósito,
 * `docs/ASSET_LICENSES.md` §5.1, así que el texto de muestra se superpone sin problema de
 * legibilidad) y, detrás, un abanico de tarjetas con las portadas reales de las otras tres
 * plantillas listas (Level 12, Aurora XV, Celeste): comunica bodas, XV años, bautizo y cumpleaños
 * con imágenes reales, no con un solo teléfono genérico ni con degradados. Decorativa
 * (aria-hidden): el mensaje ya está en el texto del hero. Si alguna plantilla dejara de estar
 * lista, su tarjeta/teléfono no se dibuja (nunca hay un hueco con degradado de repuesto).
 */
export function HeroVisual() {
  const magnolia = getTemplateCoverImage("magnolia");
  const level12 = getTemplateCoverImage("level-12");
  const auroraXv = getTemplateCoverImage("aurora-xv");
  const celeste = getTemplateCoverImage("celeste");

  return (
    <div
      aria-hidden="true"
      className="relative mx-auto h-[30rem] w-full max-w-[40rem] sm:h-[36rem] lg:ml-auto lg:h-[35.5rem]"
    >
      <span className="absolute bottom-[2%] left-1/2 h-20 w-[64%] -translate-x-1/2 rounded-[50%] bg-lu-brown-400/20 blur-2xl" />

      {/* Abanico de las otras 3 plantillas listas, detrás del teléfono principal. Solo desde `sm`:
          en móvil el espacio es justo y el teléfono ya comunica el producto por sí solo. */}
      {level12 ? (
        <TemplateThumbCard
          src={level12.src}
          className="top-[6%] left-[0%] hidden h-[48%] w-[25%] -rotate-[9deg] sm:block"
        />
      ) : null}
      {celeste ? (
        <TemplateThumbCard
          src={celeste.src}
          className="top-[3%] right-[0%] hidden h-[46%] w-[24%] rotate-[8deg] sm:block"
        />
      ) : null}
      {auroraXv ? (
        <TemplateThumbCard
          src={auroraXv.src}
          className="bottom-[3%] left-[8%] hidden h-[36%] w-[21%] rotate-[6deg] lg:block"
        />
      ) : null}

      {/* Móvil: escala 0,85 (−15 %) para que el teléfono se vea completo y con aire lateral;
          lg: anclado arriba (≈ 24 px más alto que centrado). */}
      <PhoneFrame className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-[0.85] sm:scale-100 lg:top-2 lg:translate-y-0">
        <CoverScreen sample={heroInvitationDemo} backgroundImage={magnolia ? { src: magnolia.src, alt: "" } : undefined} />
      </PhoneFrame>

      {heroBadges.map((badge) => (
        <FloatingBadge
          key={badge.id}
          icon={badgeIcons[badge.id]}
          title={badge.title}
          subtitle={badge.subtitle}
          className={`absolute z-10 ${badgePosition[badge.id]}`}
        />
      ))}
    </div>
  );
}
