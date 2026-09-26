import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ArrowBadge } from "@/components/ui/icon-button";
import { MediaSlot } from "@/components/ui/media-slot";
import type { EventCategory } from "@/types/marketing";
import { cn } from "@/lib/utils";

type EventCategoryCardProps = Pick<EventCategory, "title" | "href" | "imageSrc" | "imageAlt" | "tone"> & {
  /** Refleja la escena del placeholder para que las tarjetas vecinas no sean idénticas. */
  flip?: boolean;
  className?: string;
};

/**
 * Tarjeta de categoría de evento (mockup 01): foto 5:4 (placeholder algo más bajo que el 8:7 medido
 * mientras no haya fotografías finales; con `imageSrc` la imagen usa `object-cover`), nombre serif y flecha circular. Toda la tarjeta es un enlace. Sin `imageSrc`
 * muestra una escena difusa neutra que se lee como fotografía fuera de foco.
 * TODO(asset): replace with approved Hilo Luna asset.
 */
export function EventCategoryCard({
  title,
  href,
  imageSrc,
  imageAlt,
  tone,
  flip,
  className,
}: EventCategoryCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-lu-card outline-none",
        "focus-visible:ring-2 focus-visible:ring-lu-brown-600 focus-visible:ring-offset-2 focus-visible:ring-offset-lu-canvas",
        className,
      )}
    >
      <Card padding="none" interactive className="overflow-hidden">
        <MediaSlot
          src={imageSrc}
          alt={imageAlt}
          tone={tone}
          scene="petals"
          flip={flip}
          sizes="(min-width: 1280px) 16vw, (min-width: 768px) 30vw, 46vw"
          className="aspect-[5/4]"
          imageClassName="transition-transform duration-200 ease-lu-standard group-hover:scale-[1.03]"
        />
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-5 sm:px-5">
          {/* Sin truncar: en 2 columnas ("Baby Shower", "Cumpleaños") el nombre envuelve en dos líneas */}
          <span className="min-w-0 font-lu-display text-lu-title-sm leading-tight text-lu-text">{title}</span>
          <ArrowBadge size="sm" />
        </div>
      </Card>
    </Link>
  );
}
