import { Emphasis } from "@/components/invitation/primitives/emphasis";
import { cn } from "@/lib/utils";
import type { InvitationSection } from "@/types/invitation";
import type { InvitationTemplate } from "@/types/invitation-template";

/**
 * Encabezado de sección: etiqueta superior, titular serif con palabra en cursiva y subtítulo.
 * Los textos son del usuario (`InvitationSection`); `fallbackTitle` es el respaldo genérico.
 * La cursiva y las mayúsculas de la etiqueta las decide la plantilla; `subtitleCase` es una
 * decisión de la sección (p. ej. el itinerario pone el subtítulo en versalitas, como en [06]).
 */
export function SectionHeading({
  section,
  template,
  fallbackTitle,
  align = "center",
  subtitleCase = "normal",
  className,
}: {
  section: InvitationSection;
  template: InvitationTemplate;
  fallbackTitle?: string;
  align?: "left" | "center";
  subtitleCase?: "normal" | "upper";
  className?: string;
}) {
  const title = section.title ?? fallbackTitle;
  const { emphasis, eyebrowCase } = template.componentStyles.heading;
  return (
    <header className={cn("flex flex-col gap-2", align === "center" ? "items-center text-center" : "items-start text-left", className)}>
      {section.eyebrow ? (
        <p className={cn("font-inv-body text-[0.6875rem] font-medium tracking-[0.24em] text-inv-accent md:text-xs", eyebrowCase === "upper" && "uppercase")}>
          {section.eyebrow}
        </p>
      ) : null}
      {title ? (
        <h2 id={`${section.id}-title`} className="font-inv-display text-[2rem] leading-[1.08] font-medium text-inv-ink text-balance md:text-[2.75rem]">
          <Emphasis text={title} emphasis={emphasis} />
        </h2>
      ) : null}
      {section.subtitle ? (
        <p
          className={cn(
            "font-inv-body text-[0.8125rem] text-inv-ink-muted md:text-sm",
            subtitleCase === "upper" ? "text-[0.6875rem] tracking-[0.2em] uppercase md:text-xs" : "tracking-[0.02em]",
          )}
        >
          {section.subtitle}
        </p>
      ) : null}
    </header>
  );
}
