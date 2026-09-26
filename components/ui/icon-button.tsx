import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Botón de ícono. La forma `circle` con flecha es el patrón de las tarjetas
 * (categoría, plantilla, métrica, atajo) de los mockups 01, 02 y 05.
 */
export const iconButtonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center border",
    "transition-[background-color,border-color,color] duration-150 ease-lu-standard",
    "outline-none focus-visible:ring-2 focus-visible:ring-lu-brown-600 focus-visible:ring-offset-2 focus-visible:ring-offset-lu-canvas",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        outline:
          "border-lu-border-subtle bg-lu-surface text-lu-text hover:border-lu-border hover:bg-lu-selected",
        solid: "border-lu-ink bg-lu-ink text-lu-on-ink hover:border-lu-brown-900 hover:bg-lu-brown-900",
        ghost: "border-transparent bg-transparent text-lu-text hover:bg-lu-selected",
      },
      size: {
        sm: "size-8",
        md: "size-9",
        lg: "size-11",
      },
      shape: {
        circle: "rounded-lu-pill",
        square: "rounded-lu-button",
      },
    },
    defaultVariants: { variant: "outline", size: "md", shape: "circle" },
  },
);

type IconButtonProps = ComponentProps<"button"> &
  VariantProps<typeof iconButtonVariants> & {
    /** Obligatorio: el botón no tiene texto visible. */
    "aria-label": string;
  };

export function IconButton({
  className,
  variant,
  size,
  shape,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={cn(iconButtonVariants({ variant, size, shape }), className)}
      {...props}
    >
      {children ?? <ArrowRight aria-hidden="true" />}
    </button>
  );
}

/**
 * Versión decorativa (no interactiva) para usar dentro de una tarjeta que ya es un enlace,
 * evitando enlaces/botones anidados.
 */
export function ArrowBadge({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        iconButtonVariants({ variant: "outline", size, shape: "circle" }),
        "transition-colors group-hover:border-lu-border group-hover:bg-lu-selected",
        className,
      )}
    >
      <ArrowRight />
    </span>
  );
}
