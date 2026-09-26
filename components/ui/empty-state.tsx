import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  /** Ícono de línea fina (lucide). */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Acción principal (normalmente un <Button>). */
  action?: ReactNode;
  /** `dashed` = contenedor de borde discontinuo (patrón de "Agregar sección" y la dropzone, mockup 04). */
  variant?: "plain" | "dashed";
  className?: string;
};

/**
 * ESTADO VACÍO. Sin mockup (Q-13): compuesto con el ícono en contenedor suave del dashboard,
 * título serif y texto sans, todo con tokens existentes.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "plain",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 px-6 py-12 text-center",
        variant === "dashed" && "rounded-lu-card border border-dashed border-lu-border-strong bg-lu-surface-muted/60",
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="inline-flex size-14 items-center justify-center rounded-full bg-lu-surface-tint text-lu-brown-500 [&_svg]:size-6 [&_svg]:stroke-[1.5]"
        >
          {icon}
        </span>
      ) : null}
      <div className="flex max-w-sm flex-col gap-1.5">
        <h3 className="font-lu-display text-lu-title-md text-lu-text">{title}</h3>
        {description ? <p className="text-lu-sm text-lu-text-secondary">{description}</p> : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
