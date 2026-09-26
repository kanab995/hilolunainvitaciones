import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * TARJETA. Se separa del fondo con un filete de 1 px y una sombra muy suave, no con color
 * (las superficies de los mockups son casi idénticas). Radio 14.
 */
export const cardVariants = cva("rounded-lu-card border text-lu-text", {
  variants: {
    variant: {
      default: "border-lu-border-subtle bg-lu-surface shadow-lu-card",
      flat: "border-lu-border-subtle bg-lu-surface",
      tint: "border-transparent bg-lu-surface-tint",
    },
    padding: {
      none: "",
      md: "p-(--lu-space-card)",
      lg: "p-(--lu-space-card-lg)",
    },
    interactive: {
      true: [
        "transition-[box-shadow,border-color] duration-200 ease-lu-standard",
        "hover:border-lu-border hover:shadow-lu-card-hover",
      ],
      false: "",
    },
  },
  defaultVariants: { variant: "default", padding: "md", interactive: false },
});

type CardProps = ComponentProps<"div"> & VariantProps<typeof cardVariants>;

export function Card({ className, variant, padding, interactive, ...props }: CardProps) {
  return (
    <div className={cn(cardVariants({ variant, padding, interactive }), className)} {...props} />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return (
    <h3 className={cn("font-lu-display text-lu-title-md text-lu-text", className)} {...props} />
  );
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-lu-sm text-lu-text-secondary", className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mt-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mt-5 flex items-center gap-3", className)} {...props} />;
}
