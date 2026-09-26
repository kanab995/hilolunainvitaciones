import Image from "next/image";
import { dashboardAssets } from "@/lib/dashboard/assets";
import { cn } from "@/lib/utils";

const anchor = {
  tl: "top-0 left-0",
  tr: "top-0 right-0",
  bl: "bottom-0 left-0",
  br: "bottom-0 right-0",
} as const;

/**
 * Fragmento floral decorativo (mockup 05): un cuadrante de la hoja de esquinas aprobada de Magnolia,
 * recortado por CSS (sin crear archivos derivados). `className` define posición y tamaño. Decorativo:
 * `aria-hidden`, sin eventos de puntero, detrás del contenido y con carga diferida.
 */
export function FloralCorner({ corner, className }: { corner: keyof typeof anchor; className?: string }) {
  const { src, width, height } = dashboardAssets.cornerSheet;
  return (
    <span aria-hidden="true" className={cn("pointer-events-none absolute z-0 overflow-hidden", className)}>
      <Image src={src} alt="" width={width} height={height} sizes="240px" className={cn("absolute h-auto w-[200%] max-w-none", anchor[corner])} />
    </span>
  );
}
