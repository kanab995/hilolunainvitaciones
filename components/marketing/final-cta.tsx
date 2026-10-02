import Link from "next/link";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { Button } from "@/components/ui/button";
import { MediaSlot, SceneBlobs } from "@/components/ui/media-slot";
import { EmphasisText, Heading, Text } from "@/components/ui/typography";
import { finalCtaCopy } from "@/lib/content/home";
import { routes } from "@/lib/routes";
import { getTemplateCoverImage } from "@/lib/templates/status";

/**
 * Banner final (mockup 01): cierre visual importante. Superficie beige de radio amplio con filete y
 * sombra, texto grande a la izquierda y una fotografía a la derecha que se desvanece hacia el
 * fondo (más saturada que el resto para contrastar con el texto). La fotografía es la portada real
 * de Celeste (`getTemplateCoverImage`: flores, velas y tela clara — el tono "rosas claras sobre
 * tela" del mockup); si dejara de estar lista, vuelve al degradado de siempre.
 */
export function FinalCta() {
  const cover = getTemplateCoverImage("celeste");
  return (
    <MarketingSection labelledBy="final-cta-title">
      <div className="relative isolate overflow-hidden rounded-lu-banner border border-lu-border-subtle bg-lu-section-band shadow-lu-card">
        {cover ? (
          <MediaSlot
            src={cover.src}
            className="absolute inset-x-0 top-[42%] bottom-0 -z-10 lu-fade-top lg:inset-y-0 lg:top-0 lg:left-auto lg:w-[58%] lg:lu-fade-left"
          />
        ) : (
          <MediaSlot
            tone="blush"
            scene="roses"
            className="absolute inset-x-0 top-[42%] bottom-0 -z-10 lu-fade-top lg:inset-y-0 lg:top-0 lg:left-auto lg:w-[58%] lg:lu-fade-left"
          >
            <SceneBlobs scene="petals" flip />
          </MediaSlot>
        )}
        <div className="flex flex-col items-start gap-7 px-7 py-14 sm:px-12 lg:max-w-[46rem] lg:px-16 lg:py-24">
          <Heading
            as="h2"
            id="final-cta-title"
            size="display-md"
            className="max-w-[11em] leading-[1.03] tracking-[-0.015em] [&_em]:pr-[0.05em]"
          >
            <EmphasisText>{finalCtaCopy.title}</EmphasisText>
          </Heading>
          <Text size="md" tone="default" className="max-w-[30rem] text-lu-text-secondary">
            {finalCtaCopy.description}
          </Text>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="lg" arrow>
              <Link href={routes.signUp}>{finalCtaCopy.primaryCta}</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href={routes.templates}>{finalCtaCopy.secondaryCta}</Link>
            </Button>
          </div>
        </div>
        {/* Espacio para que la fotografía respire bajo el texto en móvil */}
        <div aria-hidden="true" className="h-52 lg:hidden" />
      </div>
    </MarketingSection>
  );
}
