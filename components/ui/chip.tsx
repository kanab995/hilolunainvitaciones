import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type ChipProps = ComponentProps<"button"> & {
  /** Estado seleccionado: tinta con texto crema (mockup 02). Se expone como `aria-pressed`. */
  active?: boolean;
};

/**
 * CHIP DE FILTRO (mockup 02): píldora de 48 px con contorno sutil; activo = tinta. Es un botón
 * de alternancia (`aria-pressed`), no un enlace. Los chips de filtro son una de las excepciones
 * intencionales de radio píldora (DESIGN_SYSTEM §3.3).
 */
export function Chip({ active = false, className, type = "button", ...props }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={cn(
        "inline-flex h-(--lu-h-chip) shrink-0 items-center justify-center rounded-lu-pill border px-6 font-lu-sans text-lu-base whitespace-nowrap",
        "transition-[background-color,border-color,color] duration-150 ease-lu-standard outline-none select-none",
        "focus-visible:ring-2 focus-visible:ring-lu-brown-600 focus-visible:ring-offset-2 focus-visible:ring-offset-lu-canvas",
        active
          ? "border-lu-ink bg-lu-ink text-lu-on-ink"
          : "border-lu-border-subtle bg-lu-surface text-lu-text hover:border-lu-border-outline hover:bg-lu-selected",
        className,
      )}
      {...props}
    />
  );
}
