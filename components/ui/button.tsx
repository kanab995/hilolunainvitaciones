import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Slot } from "radix-ui";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * BOTÓN (DESIGN_SYSTEM §3.5). Rectángulo de esquinas moderadas (10 / 12 / 16 según tamaño);
 * `shape="pill"` solo para el CTA primario de la navbar.
 * Alturas medidas en los mockups: sm 40 · md 44 · lg 54 · xl 64.
 *  - primary: tinta casi negra con texto crema (+ flecha opcional)
 *  - secondary: contorno tostado sobre superficie
 *  - ghost: sin borde
 * `font="serif"` + `size="xl"` existe solo para el detalle de plantilla (mockup 03).
 */
export const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap border font-medium",
    "transition-[background-color,border-color,color,transform] duration-150 ease-lu-standard",
    "outline-none select-none",
    "focus-visible:ring-2 focus-visible:ring-lu-brown-600 focus-visible:ring-offset-2 focus-visible:ring-offset-lu-canvas",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "data-[loading=true]:disabled:cursor-progress data-[loading=true]:disabled:opacity-100",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        primary:
          "border-lu-ink bg-lu-ink text-lu-on-ink hover:border-lu-brown-900 hover:bg-lu-brown-900 active:translate-y-px",
        secondary:
          "border-lu-border-outline bg-lu-surface text-lu-text hover:bg-lu-selected active:translate-y-px",
        ghost:
          "border-transparent bg-transparent text-lu-text hover:bg-lu-selected active:translate-y-px",
      },
      size: {
        sm: "h-(--lu-h-sm) rounded-lu-button px-4 text-lu-sm",
        md: "h-(--lu-h-md) rounded-lu-button px-5 text-lu-ui",
        lg: "h-(--lu-h-lg) rounded-lu-button-lg px-7 text-lu-base",
        xl: "h-(--lu-h-xl) rounded-lu-button-xl px-9 text-lu-lg",
      },
      /**
       * `pill` es una excepción intencional basada en los mockups: solo para el CTA primario de
       * la navbar. Los botones por defecto (md) miden 10 px y los CTA grandes 12–16 px según tamaño.
       */
      shape: {
        default: "",
        pill: "rounded-lu-pill",
      },
      font: {
        sans: "font-lu-sans",
        serif: "font-lu-display",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    compoundVariants: [
      { font: "serif", size: ["sm", "md"], class: "text-lu-title-sm" },
      { font: "serif", size: ["lg", "xl"], class: "text-lu-title-md" },
    ],
    defaultVariants: { variant: "primary", size: "md", shape: "default", font: "sans", fullWidth: false },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Renderiza el hijo (p. ej. <Link>) con los estilos del botón. */
    asChild?: boolean;
    /** Muestra el spinner y deshabilita la interacción. */
    loading?: boolean;
    /** Añade la flecha `→` final (patrón de los CTA de los mockups). */
    arrow?: boolean;
    /** Añade el ícono de enlace externo `↗` final ("Ver invitación completa" [03]). */
    external?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  shape,
  font,
  fullWidth,
  asChild = false,
  loading = false,
  arrow = false,
  external = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, shape, font, fullWidth }), className);

  if (asChild) {
    // `Slottable` inserta los íconos dentro del elemento hijo (<Link>), no a su lado.
    return (
      <Slot.Root className={classes} {...props}>
        <Slot.Slottable>{children}</Slot.Slottable>
        {arrow ? <ArrowRight aria-hidden="true" /> : null}
        {external ? <ExternalLink aria-hidden="true" /> : null}
      </Slot.Root>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      // Cargando bloquea la interacción (disabled real) pero conserva el aspecto normal.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      {...props}
    >
      {loading ? <Spinner size={16} label="Cargando" /> : null}
      {children}
      {arrow && !loading ? <ArrowRight aria-hidden="true" /> : null}
      {external && !loading ? <ExternalLink aria-hidden="true" /> : null}
    </button>
  );
}
