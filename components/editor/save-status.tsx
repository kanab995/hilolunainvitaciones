"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import type { AutosaveState } from "@/lib/editor/autosave";
import { cn } from "@/lib/utils";

const labels = {
  idle: "Sin cambios",
  saved: "Guardado",
  dirty: "Cambios sin guardar",
  saving: "Guardando…",
  error: "Error al guardar",
} as const;

/**
 * Estado de guardado de la barra superior (mockup 04: check + "Guardado"). Es una región `status`
 * (se anuncia a lectores de pantalla). En pantallas estrechas queda solo el ícono. Debajo, el estado de
 * PUBLICACIÓN («Borrador», «Publicado», «Cambios sin publicar»): «Guardado» nunca significa «Publicado».
 * `demo`: sin base de datos el guardado es simulado y así se dice («Modo demostración»).
 */
export function SaveStatus({ state, onRetry, publicationLabel, demo = false, className }: { state: AutosaveState; onRetry?: () => void; publicationLabel?: string; demo?: boolean; className?: string }) {
  const { status, message } = state;
  const Icon = status === "saving" ? Loader2 : status === "error" ? AlertCircle : Check;

  return (
    <div role="status" className={cn("flex items-center gap-2.5 text-lu-sm", status === "error" ? "text-lu-error" : "text-lu-text-secondary", className)}>
      <Icon aria-hidden="true" className={cn("size-4 shrink-0", status === "saving" && "animate-spin motion-reduce:animate-none", status === "saved" && "text-lu-success")} strokeWidth={1.75} />
      <span className="flex flex-col gap-0.5 leading-none max-md:sr-only">
        <span className="text-lu-sm leading-tight font-medium text-lu-text">{labels[status]}</span>
        {status === "error" && message ? <span className="text-lu-xs">{message}</span> : null}
        {demo ? (
          <span className="text-lu-xs leading-tight font-normal whitespace-nowrap text-lu-text-subtle/80 max-lg:hidden">Modo demostración</span>
        ) : publicationLabel && status !== "error" ? (
          <span data-publication-label className="text-lu-xs leading-tight font-normal whitespace-nowrap text-lu-text-subtle/80 max-lg:hidden">
            {publicationLabel}
          </span>
        ) : null}
      </span>
      {status === "error" && onRetry ? (
        <button type="button" onClick={onRetry} className="rounded-lu-xs text-lu-xs underline outline-none focus-visible:ring-2 focus-visible:ring-lu-brown-600">
          Reintentar
        </button>
      ) : null}
    </div>
  );
}
