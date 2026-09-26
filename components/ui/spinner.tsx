import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Indicador de carga: anillo de una sola tinta (sin degradados). */
export function Spinner({
  size = 16,
  className,
  label = "Cargando",
  ...props
}: Omit<ComponentProps<"span">, "children"> & { size?: number; label?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      style={{ width: size, height: size }}
      className={cn(
        "inline-block shrink-0 animate-spin rounded-full border-2 border-current/25 border-t-current",
        className,
      )}
      {...props}
    />
  );
}
