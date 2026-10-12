import Image from "next/image";
import type { CSSProperties } from "react";
import { Decor } from "@/components/invitation/primitives/decor";
import { Divider } from "@/components/invitation/primitives/divider";
import { InvImage } from "@/components/invitation/primitives/inv-image";
import { withAssetVersion } from "@/lib/images/asset-version";
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
 * portada (`cover.photo`), sobre esa foto. Tres variantes según `template.layout.hero`:
 *  - `centered` (mockup 06): tarjeta con forma de arco centrada sobre la imagen. Es la variante por defecto.
 *  - `split` (D-45): la imagen ocupa la parte superior y una tarjeta flotante con los datos la
 *    solapa por debajo (nombres editoriales, composición vertical en dos tiempos).
 *  - `editorial` (D-45): imagen a sangre completa con los textos directamente sobre ella, alineados a
 *    la izquierda y con el nombre en grande (sin tarjeta): portada de revista.
 * Las tres leen los mismos datos y comparten saludo personalizado, velo y botón de apertura.
 *
 * Ocupa ≈ 100 svh en móvil; en pantallas anchas el fondo (vertical) se centra con los bordes
 * desvanecidos. Es la única imagen con `priority`.
 */
export function HeroSection(props: SectionProps) {
  const layout = props.template.layout.hero;
  if (layout === "editorial") return <EditorialHero {...props} />;
  if (layout === "split") return <SplitHero {...props} />;
  return <CenteredHero {...props} />;
}

/** Imagen de portada: foto del usuario o `decor.heroBackdrop` de la plantilla (o el placeholder neutro). */
function BackdropImage({ invitation, template }: Pick<SectionProps, "invitation" | "template">) {
  const { cover } = invitation;
  const backdrop = template.decor.heroBackdrop;
  if (cover.photo?.src) return <InvImage image={cover.photo} priority sizes={BACKDROP_SIZES} className="size-full" />;
  if (backdrop?.kind === "image") {
    return (
      <Image
        src={withAssetVersion(backdrop.src)}
        alt=""
        width={backdrop.width}
        height={backdrop.height}
        sizes={BACKDROP_SIZES}
        priority
        className="size-full object-cover object-center"
      />
    );
  }
  return <InvImage sizes={BACKDROP_SIZES} className="size-full" />;
}

function alignClasses(align: "left" | "center" | "right"): string {
  return align === "left" ? "items-start text-left" : align === "right" ? "items-end text-right" : "items-center text-center";
}

function CenteredHero({ invitation, template, section, nextSectionId, personalization }: SectionProps) {
  const { cover, event } = invitation;
  const names = displayNames(invitation.names);
  const lines = joinNames(names);
  // Ajuste del usuario (no de la plantilla): alineación del texto dentro de la tarjeta.
  const align = section.align ?? "center";
  const alignClass = alignClasses(align);
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
        <BackdropImage invitation={invitation} template={template} />
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
            className={cn("inv-enter mt-4 flex flex-col font-[family-name:var(--inv-font-names,var(--inv-font-display))] font-medium text-inv-ink inv-italic", alignClass)}
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
            <p data-guest-greeting style={stagger(5)} className="inv-enter mt-1 max-w-[13rem] font-inv-display text-[1rem] leading-snug text-balance text-inv-ink inv-italic">
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

/**
 * Portada `split`: imagen arriba (≈ 62 svh) y una tarjeta flotante que la solapa. Los datos y el
 * botón viven en la tarjeta; la imagen no lleva texto encima (se ve completa).
 */
function SplitHero({ invitation, template, section, nextSectionId, personalization }: SectionProps) {
  const { cover, event } = invitation;
  const names = displayNames(invitation.names);
  const lines = joinNames(names);
  const align = section.align ?? "center";
  const alignClass = alignClasses(align);
  const divider = template.componentStyles.divider;
  const greeting = personalization?.kind === "guest" ? getGuestGreeting(personalization.guest) : undefined;

  return (
    <section
      id={section.id}
      data-section="hero"
      data-hero-layout="split"
      aria-label={names.join(" y ")}
      className="relative isolate flex min-h-svh flex-col overflow-hidden bg-inv-bg"
    >
      <div className="relative mx-auto h-[62svh] min-h-[22rem] w-full md:max-w-[36rem] md:inv-fade-x">
        <BackdropImage invitation={invitation} template={template} />
        {section.overlay ? <div aria-hidden="true" data-overlay className="absolute inset-0 bg-inv-ink/25" /> : null}
      </div>
      <Decor slot="heroCornerLeft" template={template} />
      <Decor slot="heroCornerRight" template={template} />

      <div className="inv-column relative z-10 -mt-28 pb-14 md:-mt-32">
        <div
          className={cn(
            "inv-hero-card flex flex-col rounded-(--inv-radius-card) bg-inv-surface px-7 pt-10 pb-9 shadow-[0_28px_70px_-30px_rgb(15_40_55/0.45)]",
            template.componentStyles.card.border && "border border-inv-line",
            alignClass,
          )}
        >
          <p style={stagger(0)} className="inv-enter font-inv-body text-[0.6875rem] font-medium tracking-[0.34em] text-inv-ink">
            {formatCompactDate(event.startsAt, event.timezone)}
          </p>
          {cover.eyebrow ? (
            <p style={stagger(1)} className="inv-enter mt-2 font-inv-body text-[0.6875rem] font-medium tracking-[0.34em] text-inv-accent uppercase">
              {cover.eyebrow}
            </p>
          ) : null}
          <h1
            style={stagger(1)}
            className={cn("inv-enter mt-3 flex flex-col font-[family-name:var(--inv-font-names,var(--inv-font-display))] font-medium text-inv-ink inv-italic", alignClass)}
          >
            {lines.map((line, index) => (
              <span key={`${line}-${index}`} className={cn(line === "&" ? "text-[1.75rem] leading-tight" : "text-[2.5rem] leading-[1.05] sm:text-[3rem]")}>
                {line}
              </span>
            ))}
          </h1>
          <div style={stagger(2)} className="inv-enter my-4 w-full">
            <Divider kind={divider === "none" ? "line" : divider} align={align} />
          </div>
          {cover.tagline ? (
            <p style={stagger(4)} className="inv-enter mt-1 max-w-[16rem] font-[family-name:var(--inv-font-tagline,var(--inv-font-body))] text-[0.8125rem] leading-relaxed text-pretty text-inv-ink-muted">
              {cover.tagline}
            </p>
          ) : null}
          {greeting ? (
            <p data-guest-greeting style={stagger(5)} className="inv-enter mt-2 max-w-[15rem] font-inv-display text-[1.0625rem] leading-snug text-balance text-inv-ink inv-italic">
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

/**
 * Portada `editorial`: la imagen ocupa toda la pantalla y los textos se apoyan directamente sobre
 * ella, alineados a la izquierda, con el nombre en grande y una regla fina. Un velo del color de fondo
 * (`inv-scrim`, máscara que se desvanece hacia arriba) garantiza el contraste sea cual sea la foto;
 * `section.overlay` añade el velo del usuario encima.
 */
function EditorialHero({ invitation, template, section, nextSectionId, personalization }: SectionProps) {
  const { cover, event } = invitation;
  const names = displayNames(invitation.names);
  const lines = joinNames(names);
  const align = section.align ?? "left";
  const alignClass = alignClasses(align);
  const greeting = personalization?.kind === "guest" ? getGuestGreeting(personalization.guest) : undefined;

  return (
    <section
      id={section.id}
      data-section="hero"
      data-hero-layout="editorial"
      aria-label={names.join(" y ")}
      className="relative isolate flex min-h-svh flex-col justify-end overflow-hidden bg-inv-bg"
    >
      <div className="absolute inset-0 -z-10 mx-auto md:max-w-[36rem] md:inv-fade-x">
        <BackdropImage invitation={invitation} template={template} />
        {section.overlay ? <div aria-hidden="true" data-overlay className="absolute inset-0 bg-inv-ink/25" /> : null}
        {/* Con una foto real el texto cae sobre detalle y brillos: este velo del color de fondo garantiza el contraste. */}
        <div aria-hidden="true" data-scrim className="inv-scrim absolute inset-x-0 bottom-0 h-[72%] bg-inv-bg/90" />
      </div>
      <Decor slot="heroCornerLeft" template={template} />
      <Decor slot="heroCornerRight" template={template} />

      <div className="inv-column relative pt-28 pb-14">
        <div className={cn("flex flex-col", alignClass)}>
          <div style={stagger(0)} className="inv-enter flex flex-wrap items-center gap-x-4 gap-y-1 font-inv-body text-[0.75rem] font-medium tracking-[0.36em] text-inv-accent uppercase">
            <p>{formatCompactDate(event.startsAt, event.timezone)}</p>
            {cover.eyebrow ? <p className="border-l border-inv-accent/70 pl-4">{cover.eyebrow}</p> : null}
          </div>
          <h1
            style={stagger(1)}
            className={cn(
              "inv-enter mt-3 flex flex-col font-[family-name:var(--inv-font-names,var(--inv-font-display))] font-medium tracking-[0.01em] text-inv-ink uppercase inv-italic",
              alignClass,
            )}
          >
            {lines.map((line, index) => (
              <span key={`${line}-${index}`} className={cn(line === "&" ? "text-[2rem] leading-none text-inv-accent" : "text-[5.5rem] leading-[0.88] sm:text-[7rem]")}>
                {line}
              </span>
            ))}
          </h1>
          <span aria-hidden="true" style={stagger(2)} className="inv-enter my-5 block h-px w-full bg-inv-accent/70" />
          {cover.tagline ? (
            <p style={stagger(3)} className="inv-enter max-w-[19rem] font-[family-name:var(--inv-font-tagline,var(--inv-font-body))] text-[0.9375rem] leading-relaxed text-inv-ink">
              {cover.tagline}
            </p>
          ) : null}
          {greeting ? (
            <p data-guest-greeting style={stagger(4)} className="inv-enter mt-3 max-w-[18rem] font-inv-display text-[1.25rem] leading-snug text-balance text-inv-ink inv-italic">
              {greeting.text}
            </p>
          ) : null}
          <div style={stagger(greeting ? 5 : 4)} className="inv-enter mt-7">
            <OpenInvitationButton label={cover.openLabel} targetId={nextSectionId} variant={template.componentStyles.button.variant} />
          </div>
        </div>
      </div>
    </section>
  );
}
