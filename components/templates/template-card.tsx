import Image from "next/image";
import Link from "next/link";
import { ArrowBadge } from "@/components/ui/icon-button";
import { Card } from "@/components/ui/card";
import { MediaSlot } from "@/components/ui/media-slot";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlaceholderTone } from "@/types/marketing";
import { cn } from "@/lib/utils";

type TemplateCardProps = {
  href: string;
  name: string;
  /** Categoría del evento ("Boda"). */
  category: string;
  /** Estilos ("Floral", "Minimal"…). Se muestran tras la categoría, separados por "·". */
  styles?: string[];
  /** Escena de la plantilla. Sin `imageSrc` se muestra un placeholder con una invitación de muestra. */
  imageSrc?: string;
  imageAlt?: string;
  /** Punto focal del recorte `object-cover` (solo con `imageSrc`); por defecto el centro. */
  imagePosition?: "center" | "top";
  /** Matiz del placeholder (solo sin `imageSrc`). */
  tone?: PlaceholderTone;
  /** Refleja el placeholder para variar tarjetas vecinas. */
  flip?: boolean;
  /** Prioriza la carga de la imagen (solo para la primera fila visible). */
  priority?: boolean;
  className?: string;
};

/**
 * TARJETA DE PLANTILLA. Un único componente para home, galería y "otros diseños" (mockups 01–03).
 * Toda la tarjeta es el enlace. Imagen 8:5 (medida ≈ 1,6:1), pie con nombre serif 26 +
 * metadatos y flecha circular; hover: sombra + zoom ≤ 1,03 de la imagen.
 * Soporta `imageSrc`; sin él dibuja un placeholder (escena difusa + invitación de muestra).
 * TODO(asset): replace with approved Hilo Luna asset (escena de la plantilla).
 */
export function TemplateCard({
  href,
  name,
  category,
  styles = [],
  imageSrc,
  imageAlt = "",
  imagePosition = "center",
  tone = "cream",
  flip = false,
  priority = false,
  className,
}: TemplateCardProps) {
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
        <div className="relative aspect-[8/5] overflow-hidden bg-lu-surface-tint">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className={cn(
                "object-cover transition-transform duration-200 ease-lu-standard group-hover:scale-[1.03]",
                imagePosition === "top" ? "object-top" : "object-center",
              )}
            />
          ) : (
            <MediaSlot
              tone={tone}
              scene="roses"
              flip={flip}
              className="size-full transition-transform duration-200 ease-lu-standard group-hover:scale-[1.03]"
            >
              <SampleInvitation name={name} category={category} flip={flip} />
            </MediaSlot>
          )}
        </div>
        <div className="flex items-center justify-between gap-4 px-6 py-5">
          <div className="min-w-0">
            <h3 className="truncate font-lu-display text-lu-title-lg text-lu-text">{name}</h3>
            <p className="mt-0.5 truncate text-lu-base text-lu-text-muted">
              {[category, ...styles].join(" · ")}
            </p>
          </div>
          <ArrowBadge size="md" />
        </div>
      </Card>
    </Link>
  );
}

/** Invitación de muestra del placeholder: tarjeta ladeada con el nombre de la plantilla. */
export function SampleInvitation({ name, category, flip }: { name: string; category: string; flip: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute top-[9%] bottom-[9%] flex w-[36%] flex-col items-center justify-center gap-1.5 rounded-lu-image border border-lu-border-subtle bg-lu-surface shadow-lu-float",
        flip ? "left-[12%] -rotate-[3deg]" : "right-[12%] rotate-[3deg]",
      )}
    >
      <span className="text-[0.5625rem] font-medium tracking-[0.22em] text-lu-eyebrow uppercase">
        {category}
      </span>
      <span className="font-lu-display text-lu-title-lg leading-none text-lu-brown-600 italic">{name}</span>
      <span className="h-px w-8 bg-lu-brown-400/60" />
    </span>
  );
}

/** Estado de carga de `TemplateCard` (misma geometría para evitar saltos de layout). */
export function TemplateCardSkeleton({ className }: { className?: string }) {
  return (
    <Card padding="none" aria-hidden="true" className={cn("overflow-hidden", className)}>
      <Skeleton className="aspect-[8/5] rounded-none" />
      <div className="flex items-center justify-between gap-4 px-6 py-5">
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="size-9 rounded-full" />
      </div>
    </Card>
  );
}
