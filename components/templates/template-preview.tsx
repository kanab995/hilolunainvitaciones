"use client";

import { useState } from "react";
import { PhoneFrame } from "@/components/marketing/phone-frame";
import { PreviewScreen } from "@/components/templates/preview-screens";
import { templateDetailCopy } from "@/lib/content/templates";
import { cn } from "@/lib/utils";
import type { Template } from "@/types/templates";

/**
 * VISTA PREVIA DE LA PLANTILLA (mockup 03): la invitación de muestra dentro de un teléfono y, junto
 * a él (si hay más de una pantalla), una columna de miniaturas de sus secciones (vertical en escritorio; en fila bajo el teléfono
 * en móvil). Elegir una miniatura cambia la pantalla que muestra el teléfono.
 * Recibe cualquier `Template`: el contenido (texto de ejemplo y pantallas) viene de sus datos.
 */
export function TemplatePreview({ template, className }: { template: Template; className?: string }) {
  const { sample, screens } = template.preview;
  const [activeId, setActiveId] = useState(screens[0]?.id);
  const active = screens.find((screen) => screen.id === activeId) ?? screens[0];

  if (!active) return null;

  return (
    <div
      role="group"
      aria-label={`${templateDetailCopy.previewLabel}: ${template.name}`}
      className={cn(
        "flex flex-col items-center gap-7 lg:flex-row-reverse lg:items-start lg:justify-center lg:gap-8",
        className,
      )}
    >
      <div className="relative">
        {/* Sombra difusa bajo el teléfono: lo asienta sobre la escena */}
        <span
          aria-hidden="true"
          className="absolute -bottom-5 left-1/2 -z-10 h-16 w-[82%] -translate-x-1/2 rounded-[50%] bg-lu-brown-400/25 blur-2xl"
        />
        <PhoneFrame size="lg">
          <div key={active.id} aria-hidden="true" className="h-full motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
            <PreviewScreen screen={active} sample={sample} />
          </div>
        </PhoneFrame>
      </div>

      {screens.length > 1 ? (
      <div role="group" aria-label={templateDetailCopy.screensLabel} className="flex gap-3 lg:mt-10 lg:flex-col">
        {screens.map((screen) => {
          const isActive = screen.id === active.id;
          return (
            <button
              key={screen.id}
              type="button"
              aria-pressed={isActive}
              aria-label={screen.label}
              onClick={() => setActiveId(screen.id)}
              className={cn(
                "relative block h-20 w-16 shrink-0 lg:h-25 lg:w-20 overflow-hidden rounded-lu-input border bg-lu-surface shadow-lu-card outline-none",
                "transition-[border-color,box-shadow] duration-150 ease-lu-standard",
                "focus-visible:ring-2 focus-visible:ring-lu-brown-600 focus-visible:ring-offset-2 focus-visible:ring-offset-lu-canvas",
                isActive
                  ? "border-lu-brown-500 shadow-lu-card-hover"
                  : "border-lu-border-subtle hover:border-lu-border-outline",
              )}
            >
              {/* Miniatura: la misma pantalla, medida en cqw, recortada a su parte superior */}
              <span aria-hidden="true" className="@container block size-full">
                <span className="block h-[200cqw] w-full">
                  <PreviewScreen screen={screen} sample={sample} />
                </span>
              </span>
            </button>
          );
        })}
      </div>
      ) : null}
    </div>
  );
}
