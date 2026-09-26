import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PhoneFrameProps = {
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  className?: string;
};

/**
 * Marco de smartphone vertical (mockups 01, 03, 04). Puramente presentacional: el contenido de
 * la pantalla llega por `children`. Bisel de tinta, sombra de dispositivo y muesca.
 * Proporción 9:17,5 (medida en [01]: ≈ 270 × 496 px); `md` = 272 px de ancho, `lg` = 336 px (detalle
 * de plantilla [03]). La pantalla es un contenedor (`@container`): su contenido puede medirse en `cqw`
 * y escalar con el ancho del teléfono.
 */
export function PhoneFrame({ size = "md", children, className }: PhoneFrameProps) {
  return (
    <div
      className={cn(
        "relative aspect-[9/17.5] bg-lu-ink shadow-lu-device",
        size === "lg" && "w-[21rem] rounded-[3rem] p-2.5",
        size === "md" && "w-[17rem] rounded-[2.5rem] p-2",
        size === "sm" && "w-[6.75rem] rounded-[1.5rem] p-[3px]",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "absolute left-1/2 z-10 -translate-x-1/2 rounded-full bg-lu-ink",
          size === "lg" && "top-5 h-7 w-28",
          size === "md" && "top-4 h-6 w-24",
          size === "sm" && "top-2 h-2 w-9",
        )}
      />
      <div
        className={cn(
          "@container relative h-full overflow-hidden bg-lu-surface",
          size === "lg" && "rounded-[2.5rem]",
          size === "md" && "rounded-[2.125rem]",
          size === "sm" && "rounded-[1.25rem]",
        )}
      >
        {children}
      </div>
    </div>
  );
}
