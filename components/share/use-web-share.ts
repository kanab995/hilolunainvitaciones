"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/**
 * ¿Existe la Web Share API (`navigator.share`)? Seguro para SSR: en el servidor y en la hidratación es `false`,
 * y ya en el navegador refleja la capacidad real (sin desajuste de hidratación).
 */
export function useCanWebShare(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );
}

/** ¿El error de `navigator.share` es solo que la persona cerró la hoja? (no es un error). */
export const isShareCancelled = (error: unknown): boolean => typeof error === "object" && error !== null && (error as { name?: string }).name === "AbortError";
