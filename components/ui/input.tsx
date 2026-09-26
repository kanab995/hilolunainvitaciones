import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Estilo compartido por los controles de texto (input, textarea, trigger del select).
 * Borde de 1 px `--lu-border`, fondo de superficie, foco en marrón 600. Error con los tokens de
 * feedback funcional `--lu-error` / `--lu-error-bg` (solo validación; nunca decorativo).
 */
export const controlStyles = cn(
  "w-full min-w-0 border border-lu-border bg-lu-surface text-lu-text",
  "rounded-lu-input px-3.5 placeholder:text-lu-text-subtle",
  "transition-[border-color,box-shadow,background-color] duration-150 ease-lu-standard outline-none",
  "hover:border-lu-border-outline",
  "focus-visible:border-lu-brown-600 focus-visible:ring-2 focus-visible:ring-lu-brown-600/25",
  "disabled:cursor-not-allowed disabled:border-lu-border-subtle disabled:bg-lu-surface-muted disabled:text-lu-text-subtle disabled:hover:border-lu-border-subtle",
  "aria-invalid:border-lu-error aria-invalid:bg-lu-error-bg aria-invalid:focus-visible:ring-lu-error/25",
);

type InputProps = Omit<ComponentProps<"input">, "size"> & {
  /** `serif` reproduce los valores en Cormorant que muestra el editor (mockup 04). */
  tone?: "sans" | "serif";
  invalid?: boolean;
};

export function Input({ className, tone = "sans", invalid, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        controlStyles,
        "h-(--lu-h-md)",
        tone === "serif" ? "font-lu-display text-lu-title-sm" : "font-lu-sans text-lu-base",
        className,
      )}
      {...props}
    />
  );
}
