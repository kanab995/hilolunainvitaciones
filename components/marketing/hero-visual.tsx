import { Calendar, MapPin, Music, Users } from "lucide-react";
import type { ReactNode } from "react";
import { FloatingBadge } from "@/components/marketing/floating-badge";
import { PhoneFrame } from "@/components/marketing/phone-frame";
import { TemplateThumbCard } from "@/components/marketing/template-thumb-card";
import { CoverScreen } from "@/components/templates/preview-screens";
import { heroBadges, heroInvitationDemo } from "@/lib/content/home";
import { templates } from "@/lib/content/templates";
import { getFeaturedTemplates } from "@/lib/templates/featured";
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

/** Geometría fija de las 3 tarjetas del abanico (solo hay sitio para 3 además del teléfono). */
const THUMB_SLOTS = [
  "top-[6%] left-[0%] hidden h-[48%] w-[25%] -rotate-[9deg] sm:block",
  "top-[3%] right-[0%] hidden h-[46%] w-[24%] rotate-[8deg] sm:block",
  "bottom-[3%] left-[8%] hidden h-[36%] w-[21%] rotate-[6deg] lg:block",
] as const;

/**
 * Composición visual del hero: un teléfono principal y, detrás, un abanico con las portadas reales
 * de otras plantillas listas (`getTemplateCoverImage`) — comunica varios tipos de evento con
 * imágenes reales, no con un solo teléfono genérico ni con degradados. Las 4 plantillas (teléfono +
 * 3 tarjetas) salen de `getFeaturedTemplates` (mismo orden que la sección de destacadas de la home,
 * `lib/templates/featured.ts`): si una plantilla deja de estar lista, o si se agrega una nueva con
 * más variedad de categoría, el abanico cambia solo — no hay slugs fijos aquí. El texto de muestra
 * del teléfono (Andrea & Fernando) es el de Magnolia (su portada tiene el centro despejado para
 * texto a propósito, `docs/ASSET_LICENSES.md` §5.1): solo se superpone cuando la plantilla principal
 * SIGUE siendo Magnolia, para no superponerlo por error sobre la portada de otra plantilla con un
 * centro más ocupado. Decorativa (aria-hidden): el mensaje ya está en el texto del hero.
 */
export function HeroVisual() {
  const [main, ...rest] = getFeaturedTemplates(templates, 4);
  const mainCover = main ? getTemplateCoverImage(main.slug) : undefined;
  const overlayText = main?.slug === "magnolia";

  return (
    <div
      aria-hidden="true"
      className="relative mx-auto h-[30rem] w-full max-w-[40rem] sm:h-[36rem] lg:ml-auto lg:h-[35.5rem]"
    >
      <span className="absolute bottom-[2%] left-1/2 h-20 w-[64%] -translate-x-1/2 rounded-[50%] bg-lu-brown-400/20 blur-2xl" />

      {/* Abanico de hasta 3 plantillas listas más, detrás del teléfono principal. Solo desde `sm`:
          en móvil el espacio es justo y el teléfono ya comunica el producto por sí solo. */}
      {rest.map((template, index) => {
        const cover = getTemplateCoverImage(template.slug);
        const slotClassName = THUMB_SLOTS[index];
        return cover && slotClassName ? <TemplateThumbCard key={template.id} src={cover.src} className={slotClassName} /> : null;
      })}

      {/* Móvil: escala 0,85 (−15 %) para que el teléfono se vea completo y con aire lateral;
          lg: anclado arriba (≈ 24 px más alto que centrado). */}
      <PhoneFrame className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-[0.85] sm:scale-100 lg:top-2 lg:translate-y-0">
        <CoverScreen sample={heroInvitationDemo} backgroundImage={mainCover && overlayText ? { src: mainCover.src, alt: "" } : undefined} />
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
