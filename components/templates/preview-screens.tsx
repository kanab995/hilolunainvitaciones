import type { ReactNode } from "react";
import Image from "next/image";
import { Calendar, Clock, Gift, MapPin, Music, Users } from "lucide-react";
import { MediaSlot } from "@/components/ui/media-slot";
import type { InvitationSample, TemplateScreen, TemplateScreenId } from "@/types/templates";

/**
 * PANTALLAS DE LA INVITACIÓN DE MUESTRA (vista previa del detalle [03], miniaturas, hero de la home).
 * Son ilustraciones decorativas dibujadas con texto de ejemplo y placeholders: NO son la invitación
 * de producción (esa vive bajo `/i/[slug]` con tokens --inv-*).
 *
 * Todo se mide en `cqw` (1 % del ancho del contenedor `@container` más cercano): la misma pantalla
 * se ve igual en el teléfono `md`/`lg` y en una miniatura de 80 px. Las medidas están calibradas
 * sobre una pantalla de 256 px (1 cqw = 2,56 px).
 *
 * TODO(asset): replace with approved Hilo Luna asset — flores y fotografías de cada pantalla.
 */

const title = "font-lu-display text-[11cqw] leading-none text-lu-brown-600 italic";

/** Decoración floral difusa de las esquinas (placeholder). */
function Corners() {
  return (
    <>
      <MediaSlot
        tone="blush"
        scene="petals"
        className="absolute inset-x-0 top-0 h-[30%] [mask-image:linear-gradient(to_bottom,#000_60%,transparent)]"
      />
      <MediaSlot
        tone="sage"
        scene="petals"
        flip
        className="absolute inset-x-0 bottom-0 h-[26%] [mask-image:linear-gradient(to_top,#000_60%,transparent)]"
      />
    </>
  );
}

export function CoverScreen({
  sample,
  backgroundImage,
}: {
  sample: InvitationSample;
  /**
   * Portada real de una plantilla lista (`getTemplateCoverImage`), para usar en vez del degradado
   * de `Corners()` — solo donde ya se sabe que el centro de esa imagen queda despejado para texto
   * (hoy, Magnolia en el hero de la home; `docs/ASSET_LICENSES.md` §5.1). Sin esto, el
   * comportamiento no cambia (sigue el placeholder de siempre).
   */
  backgroundImage?: { src: string; alt: string };
}) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center px-[11cqw] text-center">
      {backgroundImage ? (
        <Image src={backgroundImage.src} alt={backgroundImage.alt} fill sizes="21rem" className="object-cover" />
      ) : (
        <Corners />
      )}
      <div className="relative flex flex-col items-center gap-[5.5cqw]">
        <p className="text-[3.9cqw] font-medium tracking-[0.24em] text-lu-eyebrow uppercase">{sample.eyebrow}</p>
        <p className="flex flex-col items-center font-lu-display text-[14cqw] leading-none font-medium text-lu-brown-600 italic">
          {sample.names.map((name) => (
            <span key={name} className={name === "&" ? "text-[9.4cqw]" : undefined}>
              {name}
            </span>
          ))}
        </p>
        <p className="mt-[1.5cqw] text-[3.5cqw] font-medium tracking-[0.18em] text-lu-text-secondary uppercase">
          {sample.date}
        </p>
        <span aria-hidden="true" className="h-px w-[14cqw] bg-lu-brown-400/60" />
        <p className="flex flex-col text-[3.5cqw] font-medium tracking-[0.16em] text-lu-text-secondary uppercase">
          {sample.venue.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </p>
        <span className="mt-[3cqw] inline-flex h-[12.5cqw] items-center rounded-full bg-lu-brown-500 px-[11cqw] text-[4.3cqw] font-medium text-lu-on-ink">
          {sample.button}
        </span>
      </div>
    </div>
  );
}

function StoryScreen({ label }: { label: string }) {
  return (
    <div className="relative flex h-full flex-col items-center gap-[6cqw] px-[11cqw] pt-[22cqw] text-center">
      <p className={title}>{label}</p>
      <MediaSlot tone="cream" scene="roses" className="aspect-[4/5] w-[62%] rounded-[4cqw]" />
      <div className="flex w-[70%] flex-col items-center gap-[2cqw]">
        <span className="h-[1.4cqw] w-full rounded-full bg-lu-border-strong" />
        <span className="h-[1.4cqw] w-4/5 rounded-full bg-lu-border-strong" />
        <span className="h-[1.4cqw] w-3/5 rounded-full bg-lu-border-strong" />
      </div>
    </div>
  );
}

const detailIcons = [Calendar, MapPin, Clock, Gift, Music, Users];

function DetailsScreen({ label }: { label: string }) {
  return (
    <div className="relative flex h-full flex-col items-center gap-[7cqw] px-[11cqw] pt-[22cqw] text-center">
      <p className={title}>{label}</p>
      <div className="grid w-full grid-cols-2 gap-[3.5cqw]">
        {detailIcons.map((Icon, index) => (
          <span
            key={index}
            className="flex aspect-[5/4] items-center justify-center rounded-[3cqw] border border-lu-border-subtle bg-lu-surface shadow-lu-card"
          >
            <Icon aria-hidden="true" className="size-[8cqw] stroke-[1.5] text-lu-brown-500" />
          </span>
        ))}
      </div>
    </div>
  );
}

function GalleryScreen({ label }: { label: string }) {
  return (
    <div className="relative flex h-full flex-col items-center gap-[7cqw] px-[9cqw] pt-[22cqw] text-center">
      <p className={title}>{label}</p>
      <div className="grid w-full grid-cols-2 gap-[3cqw]">
        <MediaSlot tone="blush" scene="petals" className="aspect-[3/4] rounded-[3cqw]" />
        <MediaSlot tone="sage" scene="roses" flip className="aspect-[3/4] rounded-[3cqw]" />
        <MediaSlot tone="cream" scene="roses" className="aspect-[3/4] rounded-[3cqw]" />
        <MediaSlot tone="sand" scene="petals" flip className="aspect-[3/4] rounded-[3cqw]" />
      </div>
    </div>
  );
}

/** Dibuja la pantalla indicada. Debe colocarse dentro de un contenedor `@container` de alto definido. */
export function PreviewScreen({ screen, sample }: { screen: TemplateScreen; sample: InvitationSample }) {
  const screens: Record<TemplateScreenId, ReactNode> = {
    cover: <CoverScreen sample={sample} />,
    story: <StoryScreen label={screen.label} />,
    details: <DetailsScreen label={screen.label} />,
    gallery: <GalleryScreen label={screen.label} />,
  };
  return screens[screen.id];
}
