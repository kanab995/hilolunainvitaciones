import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Badge / etiqueta de estado. Los tonos de estado reutilizan los tintes de las métricas del
 * dashboard (mockup 05): salvia = confirmado, arena = pendiente, blush = no asistirá.
 */
export const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lu-pill border font-lu-sans font-medium",
  {
    variants: {
      tone: {
        neutral: "border-transparent bg-lu-surface-tint text-lu-text-secondary",
        outline: "border-lu-border bg-transparent text-lu-text-secondary",
        accent: "border-transparent bg-lu-blush-soft text-lu-brown-900",
        ink: "border-transparent bg-lu-ink text-lu-on-ink",
        success: "border-transparent bg-lu-success-bg text-lu-text",
        pending: "border-transparent bg-lu-pending-bg text-lu-text",
        declined: "border-transparent bg-lu-declined-bg text-lu-text",
      },
      size: {
        sm: "h-6 px-2.5 text-lu-xs",
        md: "h-7 px-3 text-lu-sm",
      },
    },
    defaultVariants: { tone: "neutral", size: "sm" },
  },
);

const dotColor: Record<NonNullable<VariantProps<typeof badgeVariants>["tone"]>, string> = {
  neutral: "bg-lu-text-subtle",
  outline: "bg-lu-text-subtle",
  accent: "bg-lu-brown-400",
  ink: "bg-lu-on-ink",
  success: "bg-lu-success",
  pending: "bg-lu-pending",
  declined: "bg-lu-brown-400",
};

type BadgeProps = ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    /** Punto de color previo al texto (útil para estados). */
    dot?: boolean;
  };

export function Badge({ className, tone, size, dot = false, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props}>
      {dot ? (
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full", dotColor[tone ?? "neutral"])}
        />
      ) : null}
      {children}
    </span>
  );
}
