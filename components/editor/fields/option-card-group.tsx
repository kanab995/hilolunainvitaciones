"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface OptionCard<T extends string> {
  value: T;
  label: string;
  /** Miniatura ilustrativa de la opción (mockup 04: alineación izquierda/centrada/derecha). */
  illustration?: ReactNode;
}

/**
 * Grupo de tarjetas de opción (radios nativos: teclado y lectores de pantalla gratis). La activa
 * lleva borde marrón 600 (mockup 04, "Alineación del contenido").
 */
export function OptionCardGroup<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
}: {
  name: string;
  legend: string;
  value: T;
  options: readonly OptionCard<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-(--lu-gap-label)">
      <legend className="mb-2 text-lu-sm font-medium text-lu-text">{legend}</legend>
      <div className="grid grid-cols-3 gap-3">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-lu-card border bg-lu-surface p-3 text-center transition-[border-color,background-color] duration-150 ease-lu-standard",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-lu-brown-600 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-lu-canvas",
              value === option.value ? "border-lu-brown-600 bg-lu-nav-active" : "border-lu-border-subtle hover:border-lu-border-outline",
            )}
          >
            <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="sr-only" />
            {option.illustration ? <span aria-hidden="true">{option.illustration}</span> : null}
            <span className="text-lu-xs text-lu-text-secondary">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
