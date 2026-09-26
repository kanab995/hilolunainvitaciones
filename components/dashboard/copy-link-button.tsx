"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { copyToClipboard } from "@/lib/dashboard/share";
import { cn } from "@/lib/utils";

type CopyState = "idle" | "copied" | "failed";

/**
 * Botón "Copiar enlace" con la Clipboard API (y método clásico de respaldo, sin librerías). Anuncia
 * el resultado en una región `status`: «Enlace copiado» o, si el navegador no lo permite, «No se pudo
 * copiar: selecciona el enlace y cópialo a mano».
 */
export function CopyLinkButton({
  text,
  variant = "icon",
  onResult,
  className,
}: {
  text: string;
  /** Avisa del resultado (p. ej. para seleccionar el campo del enlace cuando el navegador no deja copiar). */
  onResult?: (copied: boolean) => void;
  /** `icon`: solo el ícono (dentro de la píldora del enlace); `labelled`: botón con texto. */
  variant?: "icon" | "labelled";
  className?: string;
}) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    const ok = await copyToClipboard(text);
    setState(ok ? "copied" : "failed");
    onResult?.(ok);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2400);
  };

  const Icon = state === "copied" ? Check : Copy;
  const message = state === "copied" ? "Enlace copiado ✓" : state === "failed" ? "No se pudo copiar: selecciona el enlace y cópialo a mano" : "";

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={variant === "icon" ? "Copiar enlace" : undefined}
        className={cn(
          "inline-flex items-center justify-center gap-2 outline-none transition-colors duration-150 ease-lu-standard",
          "focus-visible:ring-2 focus-visible:ring-lu-brown-600 focus-visible:ring-offset-2 focus-visible:ring-offset-lu-canvas",
          variant === "icon"
            ? "size-8 rounded-lu-xs text-lu-text-secondary hover:bg-lu-selected hover:text-lu-text"
            : "h-(--lu-h-md) rounded-lu-button border border-lu-ink bg-lu-ink px-5 text-lu-ui font-medium text-lu-on-ink hover:bg-lu-brown-900",
          className,
        )}
      >
        <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
        {variant === "labelled" ? (state === "copied" ? "Copiado" : "Copiar enlace") : null}
      </button>
      <span role="status" className={cn(variant === "icon" ? "sr-only" : "text-lu-sm text-lu-text-muted", state === "failed" && "text-lu-error")}>
        {message}
      </span>
    </>
  );
}
