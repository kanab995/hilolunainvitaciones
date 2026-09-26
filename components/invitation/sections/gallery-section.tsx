import { InvImage } from "@/components/invitation/primitives/inv-image";
import { EditorPlaceholder } from "@/components/invitation/primitives/editor-placeholder";
import { SectionHeading } from "@/components/invitation/primitives/section-heading";
import { SectionShell } from "@/components/invitation/primitives/section-shell";
import type { SectionProps } from "@/components/invitation/sections/types";
import { invitationCopy } from "@/lib/invitation/copy";

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

/**
 * GALERÍA (`invitation.gallery`). Hoy solo existe la variante `grid` (mockup 06); `masonry` y
 * `carousel` son contrato sin diseño y caen a `grid`. CSS Grid con una sola unidad de fila fluida
 * (sin alturas distintas por breakpoint) y `object-fit: cover`.
 */
export function GallerySection({ invitation, template, section, index, editing }: SectionProps) {
  const { gallery } = invitation;
  if (gallery.length === 0) return editing ? <EditorPlaceholder section={section} template={template} index={index} message={invitationCopy.editorEmpty.gallery} /> : null;
  const spans = spansByCount[gallery.length] ?? fallbackSpans;

  return (
    <SectionShell section={section} template={template} index={index} width="wide" contentClassName="py-14 md:py-20">
      <div className="inv-reveal mx-auto flex max-w-[52rem] flex-col gap-7">
        <SectionHeading section={section} template={template} fallbackTitle={invitationCopy.sections.gallery} />
        <ul
          data-gallery-layout="grid"
          className="grid auto-rows-[clamp(5.25rem,21vw,9.5rem)] grid-cols-2 gap-2 md:gap-3"
        >
          {gallery.map((image, i) => (
            <li key={image.id} className={spans[i % spans.length]}>
              <InvImage image={image} sizes="(min-width: 832px) 416px, 50vw" className="size-full rounded-(--inv-radius-image)" />
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}
