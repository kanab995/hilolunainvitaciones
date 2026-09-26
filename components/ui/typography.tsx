import type { ComponentProps, ElementType, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * TIPOGRAFÍA del producto (design/DESIGN_SYSTEM.md §3.2).
 * Serif de titulares = Cormorant Garamond; sans de interfaz = Inter.
 * Los tamaños/interlineados/tracking viven en tokens (`text-lu-*` en site.css).
 */

export const headingVariants = cva("font-lu-display text-lu-text text-balance", {
  variants: {
    size: {
      "display-xl": "text-lu-display-xl",
      "display-lg": "text-lu-display-lg",
      "display-md": "text-lu-display-md",
      "display-sm": "text-lu-display-sm",
      "title-xl": "text-lu-title-xl",
      h2: "text-lu-h2",
      h3: "text-lu-h3",
      "title-lg": "text-lu-title-lg",
      "title-md": "text-lu-title-md",
      "title-sm": "text-lu-title-sm",
    },
  },
  defaultVariants: { size: "h2" },
});

type HeadingProps = Omit<ComponentProps<"h2">, "size"> &
  VariantProps<typeof headingVariants> & {
    /** Etiqueta HTML a renderizar; independiente del tamaño visual. */
    as?: ElementType;
  };

export function Heading({ as: Tag = "h2", size, className, ...props }: HeadingProps) {
  return <Tag className={cn(headingVariants({ size }), className)} {...props} />;
}

export const textVariants = cva("font-lu-sans", {
  variants: {
    size: {
      lg: "text-lu-lg",
      md: "text-lu-md",
      base: "text-lu-base",
      ui: "text-lu-ui",
      sm: "text-lu-sm",
      xs: "text-lu-xs",
    },
    tone: {
      default: "text-lu-text",
      secondary: "text-lu-text-secondary",
      muted: "text-lu-text-muted",
      subtle: "text-lu-text-subtle",
    },
  },
  defaultVariants: { size: "base", tone: "secondary" },
});

type TextProps = Omit<ComponentProps<"p">, "size"> &
  VariantProps<typeof textVariants> & { as?: ElementType };

export function Text({ as: Tag = "p", size, tone, className, ...props }: TextProps) {
  return <Tag className={cn(textVariants({ size, tone }), className)} {...props} />;
}

/** Etiqueta en MAYÚSCULAS con tracking amplio ("EDITANDO SECCIÓN"). */
export function Eyebrow({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("font-lu-sans text-lu-caps text-lu-eyebrow uppercase", className)}
      {...props}
    />
  );
}

/** Cifra grande en serif (métricas 108/31/17, numeración 01/02/03). */
export function Numeral({
  size = "md",
  className,
  ...props
}: ComponentProps<"span"> & { size?: "md" | "lg" }) {
  return (
    <span
      className={cn(
        "font-lu-display tabular-nums [font-variant-numeric:lining-nums_tabular-nums]",
        size === "lg" ? "text-lu-numeral-lg text-lu-brown-500" : "text-lu-numeral text-lu-text",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Firma tipográfica del producto: una palabra en cursiva dentro del titular.
 * Marca el énfasis con asteriscos: "Todo lo que necesitas en una *sola invitación*".
 */
export function EmphasisText({ children }: { children: string }): ReactNode {
  return children.split("*").map((part, index) =>
    index % 2 === 1 ? (
      <em key={index} className="italic">
        {part}
      </em>
    ) : (
      part
    ),
  );
}
