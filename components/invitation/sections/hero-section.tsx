import Image from "next/image";
import type { CSSProperties } from "react";
import { Decor } from "@/components/invitation/primitives/decor";
import { Divider } from "@/components/invitation/primitives/divider";
import { InvImage } from "@/components/invitation/primitives/inv-image";
import { OpenInvitationButton } from "@/components/invitation/sections/open-invitation-button";
import type { SectionProps } from "@/components/invitation/sections/types";
import { displayNames, formatCompactDate } from "@/lib/invitation/format";
import { getGuestGreeting } from "@/lib/invitation/greeting";
import { cn } from "@/lib/utils";

/** Nombres en líneas separadas por "&": ["Andrea", "Fernando"] → Andrea / & / Fernando. */
function joinNames(names: readonly string[]): string[] {
  return names.flatMap((name, index) => (index === 0 ? [name] : ["&", name]));
}

/** Posición en la entrada escalonada de la portada al cargar (`inv-enter` lee `--inv-i`; CSS puro). */
const stagger = (step: number): CSSProperties => ({ "--inv-i": step }) as CSSProperties;

const BACKDROP_SIZES = "(min-width: 768px) 576px, 100vw";

/**
 * PORTADA. Genérica: dibuja los datos de `invitation` (fecha, nombres, frase, botón) sobre el fondo
 * que aporta la PLANTILLA (`template.decor.heroBackdrop`) o, si el usuario subió una foto de
 * portada (`cover.photo`), sobre esa foto. Variante según `template.layout.hero`: hoy solo existe
 * `centered` (mockup 06); `split` y `editorial` son contrato sin diseño y caen a `centered`.
 *
 * Ocupa ≈ 100 svh en móvil; en pantallas anchas el fondo (vertical) se centra con los bordes
 * desvanecidos. Es la única imagen con `priority`. La tarjeta central es una forma de arco
 * editorial, no una tarjeta de producto.
 */
export function HeroSection({ invitation, template, section, nextSectionId, personalization }: SectionProps) {
  const { cover, event } = invitation;
  const names = displayNames(invitation.names);
  const lines = joinNames(names);
  // Ajuste del usuario (no de la plantilla): alineación del texto dentro de la tarjeta.
  const align = section.align ?? "center";
  const alignClass = align === "left" ? "items-start text-left" : align === "right" ? "items-end text-right" : "items-center text-center";
  const backdrop = template.decor.heroBackdrop;
  const divider = template.componentStyles.divider;
  // Saludo personalizado (solo con un invitado válido); la lógica del texto vive en `lib/invitation/greeting.ts`.
  const greeting = personalization?.kind === "guest" ? getGuestGreeting(personalization.guest) : undefined;

  return (
    <section
      id={section.id}
      data-section="hero"
      data-hero-layout="centered"
      aria-label={names.join(" y ")}
      className="relative isolate flex min-h-svh items-center justify-center overflow-hidden bg-inv-bg"
    >
      <div className="absolute inset-0 -z-10 mx-auto md:max-w-[36rem] md:inv-fade-x">
        {cover.photo?.src ? (
          <InvImage image={cover.photo} priority sizes={BACKDROP_SIZES} className="size-full" />
        ) : backdrop?.kind === "image" ? (
          <Image
            src={backdrop.src}
            alt=""
            width={backdrop.width}
            height={backdrop.height}
            sizes={BACKDROP_SIZES}
            priority
            className="size-full object-cover object-center"
          />
        ) : (
          <InvImage sizes={BACKDROP_SIZES} className="size-full" />
        )}
        {/* Ajuste del usuario: velo para mejorar la legibilidad del texto sobre la imagen */}
        {section.overlay ? <div aria-hidden="true" data-overlay className="absolute inset-0 bg-inv-ink/25" /> : null}
      </div>
      <Decor slot="heroCornerLeft" template={template} />
      <Decor slot="heroCornerRight" template={template} />

      <div className="inv-column relative py-12">
        <div
          className={cn(
            "inv-hero-card mx-auto flex w-[min(78%,20rem)] flex-col rounded-t-full rounded-b-(--inv-radius-card) border border-inv-line/60 bg-inv-bg/90 px-6 pt-20 pb-9 text-center md:w-[22rem] md:pt-24",
            "shadow-[0_24px_60px_-28px_rgb(73_37_18/0.35)]",
            alignClass,
          )}
        >
          <p style={stagger(0)} className="inv-enter font-inv-body text-[0.6875rem] font-medium tracking-[0.32em] text-inv-accent">
            {formatCompactDate(event.startsAt, event.timezone)}
          </p>
          {cover.eyebrow ? (
            <p style={stagger(1)} className="inv-enter mt-2 font-inv-body text-[0.6875rem] font-medium tracking-[0.3em] text-inv-accent uppercase">
              {cover.eyebrow}
            </p>
          ) : null}
          <h1
            style={stagger(2)}
            className={cn("inv-enter mt-4 flex flex-col font-[family-name:var(--inv-font-names,var(--inv-font-display))] font-medium text-inv-ink italic", alignClass)}
          >
            {lines.map((line, index) => (
              <span key={`${line}-${index}`} className={cn(line === "&" ? "text-[1.875rem] leading-tight" : "text-[2.75rem] leading-[1.02] sm:text-[3.25rem]")}>
                {line}
              </span>
            ))}
          </h1>
          <div style={stagger(3)} className="inv-enter my-4 w-full">
            <Divider kind={divider === "none" ? "line" : divider} align={align} />
          </div>
          {cover.tagline ? (
            <p style={stagger(4)} className="inv-enter max-w-[11rem] font-[family-name:var(--inv-font-tagline,var(--inv-font-body))] text-[0.6875rem] leading-relaxed tracking-[0.24em] text-inv-ink-muted uppercase">
              {cover.tagline}
            </p>
          ) : null}
          {greeting ? (
            <p data-guest-greeting style={stagger(5)} className="inv-enter mt-1 max-w-[13rem] font-inv-display text-[1rem] leading-snug text-balance text-inv-ink italic">
              {greeting.text}
            </p>
          ) : null}
          <div style={stagger(greeting ? 6 : 5)} className="inv-enter mt-6">
            <OpenInvitationButton label={cover.openLabel} targetId={nextSectionId} variant={template.componentStyles.button.variant} />
          </div>
        </div>
      </div>
    </section>
  );
}
