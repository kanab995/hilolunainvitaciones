import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import type { PlaceholderTone } from "@/types/marketing";
import { cn } from "@/lib/utils";

const tones: Record<PlaceholderTone, string> = {
  cream: "bg-lu-surface-tint",
  blush: "bg-lu-blush-soft/60",
  sage: "bg-lu-success-bg/70",
  sand: "bg-lu-section-band",
};

/**
 * ESCENAS de placeholder: composiciones de manchas de color desenfocadas (luz difusa, pétalos,
 * telas) que hacen que un bloque sin fotografía se lea como una foto neutra fuera de foco.
 * Solo usan tokens del sistema y CSS (sin imágenes, sin degradados). Son PLACEHOLDERS: cuando
 * exista el asset aprobado se pasa `src` y la escena desaparece.
 */
export type MediaScene = "petals" | "fabric" | "roses";

type Blob = {
  /** Posición y tamaño en % del ancho del contenedor. */
  x: number;
  y: number;
  size: number;
  className: string;
  blur: "blur-xl" | "blur-2xl" | "blur-3xl";
};

const scenes: Record<MediaScene, readonly Blob[]> = {
  petals: [
    { x: 55, y: -12, size: 62, className: "bg-lu-surface/90", blur: "blur-2xl" },
    { x: -10, y: 48, size: 58, className: "bg-lu-blush/45", blur: "blur-2xl" },
    { x: 46, y: 42, size: 40, className: "bg-lu-blush-soft", blur: "blur-xl" },
    { x: 8, y: -8, size: 34, className: "bg-lu-success/25", blur: "blur-2xl" },
    { x: 62, y: 62, size: 36, className: "bg-lu-brown-400/15", blur: "blur-2xl" },
  ],
  fabric: [
    { x: -30, y: 5, size: 95, className: "bg-lu-surface/80", blur: "blur-3xl" },
    { x: 25, y: -35, size: 80, className: "bg-lu-section-band", blur: "blur-3xl" },
    { x: 20, y: 45, size: 75, className: "bg-lu-brown-400/10", blur: "blur-3xl" },
    { x: 60, y: 20, size: 55, className: "bg-lu-blush-soft/70", blur: "blur-3xl" },
  ],
  roses: [
    { x: 30, y: 8, size: 62, className: "bg-lu-surface", blur: "blur-2xl" },
    { x: 8, y: 38, size: 46, className: "bg-lu-blush-soft", blur: "blur-xl" },
    { x: 58, y: 44, size: 44, className: "bg-lu-blush/40", blur: "blur-2xl" },
    { x: 66, y: -6, size: 30, className: "bg-lu-success/20", blur: "blur-2xl" },
  ],
};

/** Manchas de una escena. Se puede usar suelto (p. ej. como halo detrás de un teléfono). */
export function SceneBlobs({
  scene,
  flip = false,
  className,
}: {
  scene: MediaScene;
  /** Refleja la composición en horizontal (para variar tarjetas vecinas). */
  flip?: boolean;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0", className)}>
      {scenes[scene].map((blob, index) => {
        const style: CSSProperties = {
          left: `${flip ? 100 - blob.x - blob.size : blob.x}%`,
          top: `${blob.y}%`,
          width: `${blob.size}%`,
          aspectRatio: "1",
        };
        return (
          <span
            key={index}
            style={style}
            className={cn("absolute rounded-full", blob.className, blob.blur)}
          />
        );
      })}
    </div>
  );
}

type MediaSlotProps = {
  /** Asset aprobado y registrado en docs/ASSET_LICENSES.md. Sin `src` se muestra el placeholder. */
  src?: string;
  /** Texto alternativo. Vacío (por defecto) = imagen decorativa. */
  alt?: string;
  /** Matiz del placeholder (tokens existentes; nunca colores nuevos). */
  tone?: PlaceholderTone;
  /** Escena del placeholder (solo sin `src`). */
  scene?: MediaScene;
  flip?: boolean;
  priority?: boolean;
  sizes?: string;
  className?: string;
  imageClassName?: string;
  children?: ReactNode;
};

/**
 * Bloque de imagen con placeholder. El contenedor define el tamaño (aspect-ratio o dimensiones);
 * la imagen lo rellena. Sin `src` queda un bloque tintado con una escena difusa hecha con tokens,
 * de modo que reemplazarlo por un asset final solo requiere pasar `src`.
 *
 * TODO(asset): replace with approved Hilo Luna asset (cada uso sin `src` es un asset pendiente).
 */
export function MediaSlot({
  src,
  alt = "",
  tone = "cream",
  scene,
  flip,
  priority = false,
  sizes = "100vw",
  className,
  imageClassName,
  children,
}: MediaSlotProps) {
  return (
    <div
      data-asset-placeholder={src ? undefined : ""}
      className={cn("relative overflow-hidden", tones[tone], className)}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className={cn("object-cover", imageClassName)}
        />
      ) : scene ? (
        <SceneBlobs scene={scene} flip={flip} />
      ) : null}
      {children}
    </div>
  );
}
