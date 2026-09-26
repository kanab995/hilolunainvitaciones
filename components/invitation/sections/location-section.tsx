import { Clock, MapPin } from "lucide-react";
import { EditorPlaceholder } from "@/components/invitation/primitives/editor-placeholder";
import { InvButton } from "@/components/invitation/primitives/inv-button";
import { InvImage, photoMaskClass } from "@/components/invitation/primitives/inv-image";
import { SectionShell } from "@/components/invitation/primitives/section-shell";
import type { SectionProps } from "@/components/invitation/sections/types";
import { invitationCopy } from "@/lib/invitation/copy";
import { resolveTemplateStyle } from "@/lib/invitation/styles";
import { cn } from "@/lib/utils";
import type { EventLocation } from "@/types/invitation";
import type { DecorSlot, LocationsLayout, PhotoMask } from "@/types/invitation-template";

/**
 * SEDES (un bloque con la lista `invitation.locations`). Variante según `template.layout.locations`:
 *  - `split` (mockup 06): mitad foto / mitad texto. La primera sede lleva la foto a la izquierda en
 *    todos los tamaños; las siguientes alternan el lado desde `md` y en móvil se apilan (foto arriba).
 *  - `stacked`: foto arriba y texto centrado debajo, en todos los tamaños.
 * La lógica de ubicación (enlace de mapa, hora, dirección) es la misma para toda plantilla.
 */
export function LocationSection({ invitation, template, section, index, editing }: SectionProps) {
  // Una sede sin nombre está incompleta: no se dibuja (nunca «Sin nombre» ni un bloque vacío) hasta completarla.
  const locations = invitation.locations.filter((location) => location.name.trim());
  if (locations.length === 0) return editing ? <EditorPlaceholder section={section} template={template} index={index} message={invitationCopy.editorEmpty.locations} /> : null;
  const layout = template.layout.locations;
  const mask = resolveTemplateStyle(template).photoMask;
  const corners: readonly DecorSlot[][] = [["sectionTopRight"], ["sectionBottomRight"]];

  return (
    <div data-section="locations" data-locations-layout={layout} id={section.id}>
      {locations.map((location, i) => (
        <LocationBlock
          key={location.id}
          location={location}
          layout={layout}
          mask={mask}
          alternate={i % 2 === 1}
          decor={corners[i % corners.length] ?? []}
          shellProps={{ section: { ...section, id: `${section.id}-${location.id}`, title: undefined }, template, index: index + i }}
          buttonVariant={template.componentStyles.button.variant}
        />
      ))}
    </div>
  );
}

function LocationBlock({
  location,
  layout,
  mask,
  alternate,
  decor,
  shellProps,
  buttonVariant,
}: {
  location: EventLocation;
  layout: LocationsLayout;
  mask: PhotoMask;
  /** Segunda, cuarta… sede: cambia de lado desde `md` y se apila en móvil. */
  alternate: boolean;
  decor: readonly DecorSlot[];
  shellProps: Pick<SectionProps, "section" | "template" | "index">;
  buttonVariant: "solid" | "outline";
}) {
  const stacked = layout === "stacked";
  const stackedOnMobile = !stacked && alternate;

  const direction = stacked ? "bottom" : alternate ? "left" : "right";
  const rowClass = stacked
    ? "flex-col"
    : alternate
      ? "flex-col md:flex-row-reverse"
      : "flex-row";
  const photoClass = stacked
    ? "h-64 w-full md:h-96"
    : alternate
      ? "h-64 w-full md:h-auto md:min-h-[30rem] md:w-1/2"
      : "min-h-[19rem] w-[44%] md:min-h-[30rem] md:w-1/2";

  return (
    <SectionShell {...shellProps} width="bleed" decor={decor} decorSize="sm">
      <div className={cn("inv-reveal mx-auto flex w-full max-w-(--inv-wide-max)", rowClass)}>
        <InvImage
          image={location.photo}
          sizes={stacked ? "(min-width: 1024px) 1024px, 100vw" : "(min-width: 1024px) 512px, (min-width: 768px) 50vw, 44vw"}
          className={cn("shrink-0", photoClass, photoMaskClass(mask, direction, stackedOnMobile || stacked))}
        />
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-3 px-5 py-9 md:justify-center md:gap-4 md:px-14 md:py-16",
            stacked && "items-center text-center",
            !stacked && "items-start",
          )}
        >
          <p className="font-inv-body text-[0.6875rem] font-medium tracking-[0.24em] text-inv-accent uppercase md:text-xs">
            {invitationCopy.locationKind[location.kind]}
          </p>
          <h2 className="font-inv-display text-[1.75rem] leading-[1.1] font-medium text-inv-ink italic text-balance md:text-[2.5rem]">{location.name}</h2>
          <div className="flex items-start gap-2.5 font-inv-body text-[0.8125rem] leading-snug text-inv-ink-muted md:text-[0.9375rem]">
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-inv-accent" strokeWidth={1.5} />
            <address className="not-italic">
              {location.addressLines.filter((line) => line.trim()).map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          </div>
          {location.time ? (
            <p className="flex items-center gap-2.5 font-inv-body text-[0.8125rem] text-inv-ink-muted md:text-[0.9375rem]">
              <Clock aria-hidden="true" className="size-4 shrink-0 text-inv-accent" strokeWidth={1.5} />
              {location.time}
            </p>
          ) : null}
          {location.mapUrl ? (
            <InvButton
              href={location.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant={buttonVariant === "solid" ? "outline" : buttonVariant}
              arrow
              className="mt-2"
            >
              {invitationCopy.howToGet}
              <span className="sr-only">
                {" "}
                a {location.name} (se abre en una pestaña nueva)
              </span>
            </InvButton>
          ) : null}
        </div>
      </div>
    </SectionShell>
  );
}
