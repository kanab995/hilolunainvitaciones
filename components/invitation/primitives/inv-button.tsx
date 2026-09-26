import { ArrowRight } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type InvButtonProps = ComponentProps<"a"> & {
  /** `solid` = relleno; `outline` = contorno. Lo fija la plantilla, salvo botones secundarios. */
  variant?: "solid" | "outline";
  size?: "md" | "lg";
  /** Añade la flecha `→` final (patrón de los CTA del mockup 06). */
  arrow?: boolean;
};

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-(--inv-radius-button) border font-inv-body text-sm font-medium outline-none " +
  "transition-[background-color,color,border-color] duration-200 " +
  "focus-visible:ring-2 focus-visible:ring-inv-accent focus-visible:ring-offset-2 focus-visible:ring-offset-inv-bg";

/** Botón-enlace de la invitación (tokens --inv-*). El aspecto (relleno/contorno, forma) lo aporta la plantilla. */
export function InvButton({ variant = "solid", size = "md", arrow = false, className, children, ...props }: InvButtonProps) {
  return (
    <a
      className={cn(
        base,
        size === "lg" ? "h-12 px-8" : "h-10 px-5",
        variant === "solid"
          ? "border-inv-button-bg bg-inv-button-bg text-inv-button-fg hover:opacity-90"
          : "border-inv-accent/60 bg-transparent text-inv-ink hover:bg-inv-surface/60",
        className,
      )}
      {...props}
    >
      {children}
      {arrow ? <ArrowRight aria-hidden="true" className="size-4" strokeWidth={1.75} /> : null}
    </a>
  );
}

/** Variante de botón como clases, para <button> (formulario RSVP). */
export function invButtonClass(variant: "solid" | "outline", size: "md" | "lg" = "md") {
  return cn(
    base,
    size === "lg" ? "h-12 px-8" : "h-10 px-5",
    variant === "solid"
      ? "border-inv-button-bg bg-inv-button-bg text-inv-button-fg hover:opacity-90"
      : "border-inv-accent/60 bg-transparent text-inv-ink hover:bg-inv-surface/60",
  );
}
