import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ImageRef } from "@/types/invitation";
import type { PhotoMask } from "@/types/invitation-template";

/** Dirección hacia la que se desvanece una foto ("fade") según su posición junto al texto. */
export type FadeDirection = "bottom" | "right" | "left";

/**
 * Clase de la máscara de foto según el efecto de la PLANTILLA (`effects.photoMask`) y la posición
 * de la foto en la sección (`direction`). La plantilla decide el efecto; la sección, hacia dónde.
 */
export function photoMaskClass(mask: PhotoMask, direction: FadeDirection = "bottom", stackedBelowMd = false): string {
  if (mask === "arch") return "inv-photo-arch";
  if (mask !== "fade") return "";
  const side = direction === "right" ? "inv-photo-fade-r" : direction === "left" ? "inv-photo-fade-l" : "inv-photo-fade";
  // Apilada en móvil la foto se desvanece hacia abajo; desde `md` vuelve a desvanecerse hacia el texto.
  return stackedBelowMd ? `inv-photo-fade md:${side}` : side;
}

type InvImageProps = {
  /** Imagen del contenido. Sin `src` (o sin imagen) se dibuja un placeholder neutro. */
  image?: ImageRef;
  className?: string;
  /** Atributo `sizes` de `next/image`: ancho real con el que se muestra (evita cargar de más). */
  sizes: string;
  /** Solo la imagen principal sobre el pliegue. El resto carga de forma diferida. */
  priority?: boolean;
  /** Punto focal del recorte (`object-position`). */
  position?: string;
  /** Mezcla la imagen con el fondo (ilustraciones sobre fondo crema). */
  blend?: boolean;
  children?: ReactNode;
};

/** Proporción por defecto de los originales (1122 × 1402). Solo reserva espacio si el contenedor no lo define. */
const DEFAULT_SIZE = { width: 1122, height: 1402 } as const;

/**
 * Imagen de la invitación. Con `image.src` usa `next/image` con `width`/`height` reales (sin salto
 * de diseño), `sizes` explícito y `object-fit: cover`; el contenedor define el recorte. Sin `src`
 * dibuja un placeholder hecho con manchas difusas de los colores del TEMA (`--inv-*`), de modo que
 * una imagen opcional que falta no rompe la invitación. Decorativa si no hay `image.alt`.
 */
export function InvImage({ image, className, sizes, priority, position, blend, children }: InvImageProps) {
  return (
    <div className={cn("relative overflow-hidden bg-inv-surface", blend && "bg-transparent", className)}>
      {image?.src ? (
        <Image
          src={image.src}
          alt={image.alt}
          width={image.width ?? DEFAULT_SIZE.width}
          height={image.height ?? DEFAULT_SIZE.height}
          sizes={sizes}
          priority={priority}
          // Vista previa local del editor (blob:): no pasa por el optimizador de Next.
          unoptimized={image.src.startsWith("blob:") || undefined}
          className={cn("absolute inset-0 size-full object-cover", blend && "mix-blend-multiply")}
          style={position ? { objectPosition: position } : undefined}
        />
      ) : (
        <div role={image ? "img" : undefined} aria-label={image?.alt} aria-hidden={image ? undefined : true} className="absolute inset-0">
          <span className="absolute -top-1/4 -left-1/4 size-3/4 rounded-full bg-inv-bg opacity-80 blur-3xl" />
          <span className="absolute -right-1/4 top-1/4 size-3/4 rounded-full bg-inv-accent opacity-25 blur-3xl" />
          <span className="absolute -bottom-1/4 left-1/4 size-2/3 rounded-full bg-inv-line opacity-60 blur-3xl" />
        </div>
      )}
      {children}
    </div>
  );
}
