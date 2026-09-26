import Link from "next/link";
import { HeroVisual } from "@/components/marketing/hero-visual";
import { Button } from "@/components/ui/button";
import { MediaSlot } from "@/components/ui/media-slot";
import { EmphasisText, Eyebrow, Heading, Text } from "@/components/ui/typography";
import { heroCopy } from "@/lib/content/home";
import { routes } from "@/lib/routes";

/**
 * Hero de la home (mockup 01). Dos columnas en escritorio; apilado en móvil. La sección se
 * extiende por debajo de la navbar (transparente) y el fondo se desvanece hacia el lienzo.
 *
 * TODO(asset): replace with approved Hilo Luna asset — fotografía de fondo (telas y flores claras).
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate -mt-(--lu-header-h) overflow-clip"
    >
      <MediaSlot
        tone="sand"
        scene="fabric"
        className="absolute inset-x-0 top-[50%] bottom-0 -z-10 lu-fade-y lg:inset-y-0 lg:top-0 lg:left-auto lg:w-[64%] lg:lu-fade-left-bottom"
      />

      <div className="lu-container grid items-center gap-6 pt-[calc(var(--lu-header-h)+2rem)] pb-10 lg:min-h-[36rem] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-4 lg:pt-[calc(var(--lu-header-h)+1.5rem)] lg:pb-14">
        <div className="lu-enter flex max-w-[37rem] flex-col items-start gap-6">
          <Eyebrow>{heroCopy.eyebrow}</Eyebrow>
          {/* Editorial: interlineado ceñado, tracking ligeramente cerrado y bloque de ≈ 10,5 em */}
          <Heading
            as="h1"
            id="hero-title"
            size="display-md"
            className="-mt-1 max-w-[10.5em] leading-[1.02] tracking-[-0.015em] [&_em]:pr-[0.05em]"
          >
            <EmphasisText>{heroCopy.title}</EmphasisText>
          </Heading>
          <Text size="md" className="max-w-[35rem]">
            {heroCopy.description}
          </Text>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="lg" arrow>
              <Link href={routes.signUp}>{heroCopy.primaryCta}</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href={routes.templates}>{heroCopy.secondaryCta}</Link>
            </Button>
          </div>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-lu-sm text-lu-text-muted sm:gap-x-3 sm:gap-y-1.5">
            {heroCopy.highlights.map((item, index) => (
              <li key={item} className="flex items-center sm:gap-3">
                {index > 0 ? (
                  <span aria-hidden="true" className="hidden text-lu-text-subtle sm:inline">
                    •
                  </span>
                ) : null}
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="lu-enter">
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}
