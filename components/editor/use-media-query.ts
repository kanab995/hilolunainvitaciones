"use client";

import { useSyncExternalStore } from "react";

/** `matchMedia` como estado. En el servidor (y en la hidratación) vale `false`: primero móvil. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
