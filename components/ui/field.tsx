import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FieldProps = {
  /** `id` del control; enlaza la etiqueta, la ayuda y el error. */
  htmlFor: string;
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  /** Contador "11 / 50" a la derecha de la etiqueta (mockup 04). */
  counter?: { value: number; max: number };
  optional?: boolean;
  className?: string;
};

/** Convención de ids asociados: `${htmlFor}-hint` y `${htmlFor}-error` (para aria-describedby). */
export const fieldHintId = (id: string) => `${id}-hint`;
export const fieldErrorId = (id: string) => `${id}-error`;

/**
 * Etiqueta + control + contador + ayuda + error.
 * El control hijo debe llevar `id={htmlFor}` y `aria-describedby` con los ids anteriores.
 */
export function Field({
  htmlFor,
  label,
  children,
  hint,
  error,
  counter,
  optional,
  className,
}: FieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-(--lu-gap-label)", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="min-w-0 text-lu-sm font-medium text-lu-text">
          {label}
          {optional ? <span className="ml-1.5 font-normal whitespace-nowrap text-lu-text-subtle">(opcional)</span> : null}
        </label>
        {counter ? (
          <span
            className={cn(
              "shrink-0 text-lu-xs whitespace-nowrap tabular-nums",
              counter.value > counter.max ? "text-lu-error" : "text-lu-text-subtle",
            )}
          >
            {counter.value} / {counter.max}
          </span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p id={fieldErrorId(htmlFor)} className="text-lu-sm text-lu-error">
          {error}
        </p>
      ) : hint ? (
        <p id={fieldHintId(htmlFor)} className="text-lu-sm text-lu-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
