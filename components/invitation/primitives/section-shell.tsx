import type { ReactNode } from "react";
import { Decor, type DecorSize } from "@/components/invitation/primitives/decor";
import type { SectionProps } from "@/components/invitation/sections/types";
import { resolveTemplateStyle } from "@/lib/invitation/styles";
import { cn } from "@/lib/utils";
import type { DecorSlot } from "@/types/invitation-template";

type SectionShellProps = Pick<SectionProps, "section" | "template" | "index"> & {
  children: ReactNode;
  /** Esquinas decorativas de la plantilla que esta sección usa (cada sección elige las suyas). */
  decor?: readonly DecorSlot[];
  decorSize?: DecorSize;
  /**
   * Ancho del contenido: `column` = columna de texto (--inv-column-max); `wide` = composición
   * fotográfica que puede ensancharse en pantallas grandes (--inv-wide-max); `bleed` = sin contenedor.
   */
  width?: "column" | "wide" | "bleed";
  className?: string;
  contentClassName?: string;
};

/**
 * Envoltura común de secciones: banda de fondo (alterna según la plantilla), textura de papel y
 * viñeta si la plantilla los pide, decoración de esquina y contenedor centrado. Rotulada por
 * `aria-labelledby` cuando la sección tiene titular.
 */
export function SectionShell({
  section,
  template,
  index,
  children,
  decor = [],
  decorSize,
  width = "column",
  className,
  contentClassName,
}: SectionShellProps) {
  const style = resolveTemplateStyle(template);
  return (
    <section
      id={section.id}
      data-section={section.type}
      aria-labelledby={section.title ? `${section.id}-title` : undefined}
      className={cn(
        "relative isolate overflow-hidden text-inv-ink-muted",
        style.sectionBackground(index),
        style.paper && "inv-paper",
        style.vignette && "inv-vignette",
        className,
      )}
    >
      {decor.map((slot) => (
        <Decor key={slot} slot={slot} template={template} size={decorSize} />
      ))}
      <div className={cn("relative z-10", width === "column" && "inv-column", width === "wide" && "inv-wide", contentClassName)}>{children}</div>
    </section>
  );
}
