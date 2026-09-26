import { MediaSlot, SceneBlobs } from "@/components/ui/media-slot";
import { EmphasisText, Eyebrow, Heading, Text } from "@/components/ui/typography";

type PageHeroProps = {
  eyebrow: string;
  /** Titular de la página (`h1`). */
  title: string;
  /** Línea serif bajo el titular. */
  subtitle?: string;
  /** Párrafo de apoyo. */
  description?: string;
  headingId: string;
};

/**
 * Héroe editorial de las páginas interiores de marketing (mockup 02): eyebrow, titular grande,
 * subtítulo serif y párrafo a la izquierda, con una fotografía a la derecha que se desvanece hacia
 * el lienzo. Se extiende por debajo de la navbar transparente, como el héroe de la home.
 * TODO(asset): replace with approved Hilo Luna asset — flores y tarjeta de invitación sobre tela.
 */
export function PageHero({ eyebrow, title, subtitle, description, headingId }: PageHeroProps) {
  return (
    <section aria-labelledby={headingId} className="relative isolate -mt-(--lu-header-h) overflow-clip">
      <MediaSlot
        tone="blush"
        scene="roses"
        className="absolute inset-x-0 bottom-0 -z-10 h-44 lu-fade-top lg:inset-y-0 lg:right-0 lg:left-auto lg:h-auto lg:w-[58%] lg:lu-fade-left"
      >
        <SceneBlobs scene="fabric" flip />
      </MediaSlot>

      <div className="lu-container pt-[calc(var(--lu-header-h)+1.5rem)] pb-10 lg:pb-12">
        <div className="lu-enter flex max-w-[38rem] flex-col items-start gap-3">
          <Eyebrow>{eyebrow}</Eyebrow>
          <div className="flex flex-col gap-2">
            <Heading as="h1" id={headingId} size="display-xl" className="leading-[0.95]">
              {title}
            </Heading>
            {subtitle ? (
              <Heading as="p" size="display-sm">
                <EmphasisText>{subtitle}</EmphasisText>
              </Heading>
            ) : null}
          </div>
          {description ? (
            <Text size="md" className="mt-1 max-w-[30rem]">
              {description}
            </Text>
          ) : null}
        </div>
        {/* Espacio para que la fotografía respire bajo el texto en móvil */}
        <div aria-hidden="true" className="h-24 lg:hidden" />
      </div>
    </section>
  );
}
