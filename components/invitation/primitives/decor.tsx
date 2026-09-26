import Image from "next/image";
import { cn } from "@/lib/utils";
import type { DecorFragment, DecorSlot, InvitationTemplate } from "@/types/invitation-template";

/** Posición de cada zona respecto de su sección (las esquinas asoman ligeramente fuera). */
const slotPosition: Record<DecorSlot, string> = {
  heroBackdrop: "inset-0",
  heroCornerLeft: "-top-8 -left-10",
  heroCornerRight: "top-1/4 -right-12",
  sectionTopLeft: "-top-4 -left-6",
  sectionTopRight: "-top-4 -right-6",
  sectionBottomLeft: "-bottom-4 -left-6",
  sectionBottomRight: "-bottom-4 -right-6",
};

/** Tamaño del recorte visible. La hoja completa se dibuja al doble y se ancla a su esquina. */
const sizes = {
  sm: { box: "size-24 sm:size-32", sizes: "(min-width: 640px) 256px, 192px" },
  md: { box: "size-[7.5rem] sm:size-40 lg:size-48", sizes: "(min-width: 1024px) 384px, (min-width: 640px) 320px, 240px" },
  lg: { box: "size-40 sm:size-56 lg:size-64", sizes: "(min-width: 1024px) 512px, (min-width: 640px) 448px, 320px" },
} as const;

/** Esquina de la hoja a la que se ancla la imagen (2 × 2): muestra solo ese cuadrante. */
const anchor: Record<DecorFragment, string> = {
  tl: "top-0 left-0",
  tr: "top-0 right-0",
  bl: "bottom-0 left-0",
  br: "bottom-0 right-0",
};

const tone = { accent: "bg-inv-accent/25", surface: "bg-inv-surface", line: "bg-inv-line/60" } as const;

export type DecorSize = keyof typeof sizes;

/**
 * Decoración de plantilla en una zona (`slot`). Es de la PLANTILLA, no del contenido. Con imagen:
 * la hoja de esquinas se recorta por posicionamiento CSS (`overflow-hidden` + ancla), sin crear
 * archivos derivados; `next/image` la sirve redimensionada y en carga diferida. Sin asset aprobado
 * dibuja una mancha difusa del tema. Decorativa: `aria-hidden`, sin eventos de puntero, y siempre
 * por debajo del contenido (no bloquea textos ni botones).
 * TODO(asset): replace with approved Hilo Luna asset (plantillas sin decoración propia).
 */
export function Decor({
  slot,
  template,
  size = "md",
  className,
}: {
  slot: DecorSlot;
  template: InvitationTemplate;
  size?: DecorSize;
  className?: string;
}) {
  const asset = template.decor[slot];
  if (!asset) return null;

  if (asset.kind === "image" && asset.fragment) {
    return (
      <span
        aria-hidden="true"
        data-decor={slot}
        className={cn("inv-decor pointer-events-none absolute z-0 overflow-hidden", slotPosition[slot], sizes[size].box, className)}
      >
        <Image
          src={asset.src}
          alt=""
          width={asset.width}
          height={asset.height}
          sizes={sizes[size].sizes}
          className={cn("absolute h-auto w-[200%] max-w-none", anchor[asset.fragment])}
        />
      </span>
    );
  }

  if (asset.kind === "placeholder") {
    return (
      <span
        aria-hidden="true"
        data-decor={slot}
        className={cn("inv-decor pointer-events-none absolute z-0 rounded-full blur-2xl", slotPosition[slot], sizes[size].box, tone[asset.tone], className)}
      />
    );
  }

  return null;
}
