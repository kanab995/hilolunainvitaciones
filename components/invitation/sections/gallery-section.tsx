import { InvImage, photoMaskClass } from "@/components/invitation/primitives/inv-image";
import { EditorPlaceholder } from "@/components/invitation/primitives/editor-placeholder";
import { SectionHeading } from "@/components/invitation/primitives/section-heading";
import { SectionShell } from "@/components/invitation/primitives/section-shell";
import type { SectionProps } from "@/components/invitation/sections/types";
import { invitationCopy } from "@/lib/invitation/copy";
import { cn } from "@/lib/utils";

/**
 * Patrón del mosaico asimétrico de [06]: rejilla de 2 columnas con celdas de alto variable
 * (`row-span-*`). Con 4 imágenes forma dos columnas de 5 filas (3+2 y 2+3); con 5, el mosaico
 * completo de [06]; con cualquier otra cantidad el patrón se repite. Es presentación de la
 * variante: las imágenes son datos.
 */
const spansByCount: Record<number, readonly string[]> = {
  4: ["row-span-3", "row-span-2", "row-span-3", "row-span-2"],
  5: ["row-span-3", "row-span-2", "row-span-2", "row-span-2", "row-span-3"],
};
const fallbackSpans = ["row-span-3", "row-span-2", "row-span-2", "row-span-3"] as const;

/** Proporciones que alternan en `masonry` (recortan la foto, no la deforman). */
const masonryRatios = ["aspect-[4/5]", "aspect-square", "aspect-[3/4]", "aspect-[5/6]", "aspect-[4/5]"] as const;

/**
 * GALERÍA (`invitation.gallery`). Variante según `template.layout.gallery` (D-45 completó las dos
 * que eran solo contrato):
 *  - `grid` (mockup 06): mosaico asimétrico de 2 columnas con una sola unidad de fila fluida.
 *  - `masonry`: dos columnas de alto libre; las fotos alternan proporción y la segunda columna baja
 *    para romper la línea (composición de álbum, no de cuadrícula).
 *  - `carousel`: tira horizontal con imán (scroll-snap, sin JavaScript); foto grande con la siguiente
 *    asomando. Es una región con foco de teclado para poder recorrerla sin ratón.
 * Todas usan `object-fit: cover` y la máscara de foto de la plantilla.
 */
export function GallerySection({ invitation, template, section, index, editing }: SectionProps) {
  const { gallery } = invitation;
  if (gallery.length === 0) return editing ? <EditorPlaceholder section={section} template={template} index={index} message={invitationCopy.editorEmpty.gallery} /> : null;
  const layout = template.layout.gallery;
  const mask = template.effects.photoMask ?? "none";

  return (
    <SectionShell section={section} template={template} index={index} width="wide" contentClassName="py-14 md:py-20">
      <div className="inv-reveal mx-auto flex max-w-[52rem] flex-col gap-7">
        <SectionHeading section={section} template={template} fallbackTitle={invitationCopy.sections.gallery} />
        {layout === "carousel" ? (
          <ul
            data-gallery-layout="carousel"
            tabIndex={0}
            aria-label={section.title ? `${section.title.replaceAll("*", "")} (desliza para ver más)` : "Galería (desliza para ver más)"}
            className="-mx-(--inv-gutter) flex snap-x snap-mandatory gap-3 overflow-x-auto px-(--inv-gutter) pb-3 outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-inv-accent [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0"
          >
            {gallery.map((image) => (
              <li key={image.id} className="w-[68%] shrink-0 snap-center sm:w-[15rem] md:w-[16.5rem]">
                <InvImage image={image} sizes="(min-width: 768px) 264px, 68vw" className={cn("aspect-[4/5] w-full rounded-(--inv-radius-image)", mask === "arch" && photoMaskClass("arch"))} />
              </li>
            ))}
          </ul>
        ) : layout === "masonry" ? (
          <ul data-gallery-layout="masonry" className="grid grid-cols-2 items-start gap-x-2.5 gap-y-2.5 md:gap-x-3 md:gap-y-3">
            {gallery.map((image, i) => (
              <li key={image.id} className={cn(i % 2 === 1 && "mt-8 md:mt-12")}>
                <InvImage image={image} sizes="(min-width: 832px) 416px, 50vw" className={cn("w-full rounded-(--inv-radius-image)", masonryRatios[i % masonryRatios.length])} />
              </li>
            ))}
          </ul>
        ) : (
          <ul data-gallery-layout="grid" className="grid auto-rows-[clamp(5.25rem,21vw,9.5rem)] grid-cols-2 gap-2 md:gap-3">
            {gallery.map((image, i) => {
              const spans = spansByCount[gallery.length] ?? fallbackSpans;
              return (
                <li key={image.id} className={spans[i % spans.length]}>
                  <InvImage image={image} sizes="(min-width: 832px) 416px, 50vw" className="size-full rounded-(--inv-radius-image)" />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SectionShell>
  );
}
