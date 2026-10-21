/**
 * LLEGADA POR ANCLA (`/i/<slug>#regalos`, D-49): el navegador ya desplaza hasta el ancla, pero si algo carga tarde por encima (imágenes,
 * fuentes) el destino puede quedar desplazado; y el foco se queda al principio de la página (un lector de pantalla empezaría por la portada).
 * Esto vuelve a alinear el destino mientras la página se asienta —solo hasta que la persona toca, desplaza o pulsa una tecla, y como mucho
 * unos segundos— y le pasa el foco sin moverlo. Sin dependencias de React: se prueba con un DOM falso.
 */
export const ANCHOR_SETTLE_MS = 6000;

export interface AnchorEnvironment {
  hash: string;
  getElementById(id: string): HTMLElement | null;
  /** Avisa de cambios de tamaño del documento (p. ej. un `ResizeObserver` sobre el `body`); devuelve cómo dejar de escuchar. */
  onLayoutChange(listener: () => void): () => void;
  /** Interacción de la persona (toque, rueda, tecla): a partir de ahí no se vuelve a desplazar. */
  onUserIntent(listener: () => void): () => void;
  /** Momentos en que la página termina de asentarse (fuentes listas, `load`). */
  onSettled(listener: () => void): () => void;
  setTimeout(callback: () => void, ms: number): () => void;
}

/** Id de destino de un `location.hash` («#regalos» → «regalos»); `undefined` si no es un id razonable. */
export function anchorIdFrom(hash: string): string | undefined {
  if (!hash || hash.length < 2) return undefined;
  let id: string;
  try {
    id = decodeURIComponent(hash.slice(1));
  } catch {
    return undefined;
  }
  return /^[A-Za-z][\w-]{0,63}$/.test(id) ? id : undefined;
}

/** Mantiene el destino del ancla en su sitio mientras la página carga y le da el foco. Devuelve la limpieza. */
export function keepAnchorInPlace(env: AnchorEnvironment): () => void {
  const id = anchorIdFrom(env.hash);
  const anchor = id ? env.getElementById(id) : null;
  if (!anchor) return () => undefined;
  // El foco va a la sección que contiene el ancla (su contenido se lee desde ahí), sin desplazar.
  const target = anchor.closest("section") ?? anchor;
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });

  let active = true;
  const align = () => {
    if (active) anchor.scrollIntoView({ block: "start", behavior: "auto" });
  };
  const stops: Array<() => void> = [];
  const stop = () => {
    if (!active) return;
    active = false;
    for (const off of stops) off();
  };
  stops.push(env.onLayoutChange(align), env.onSettled(align), env.onUserIntent(stop), env.setTimeout(stop, ANCHOR_SETTLE_MS));
  return stop;
}

/** Entorno real del navegador. */
export function browserAnchorEnvironment(): AnchorEnvironment {
  return {
    hash: window.location.hash,
    getElementById: (id) => document.getElementById(id),
    onLayoutChange(listener) {
      if (typeof ResizeObserver === "undefined") return () => undefined;
      const observer = new ResizeObserver(() => listener());
      observer.observe(document.body);
      return () => observer.disconnect();
    },
    onUserIntent(listener) {
      const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
      for (const name of events) window.addEventListener(name, listener, { passive: true, once: true });
      return () => {
        for (const name of events) window.removeEventListener(name, listener);
      };
    },
    onSettled(listener) {
      let live = true;
      const fire = () => {
        if (live) listener();
      };
      void document.fonts?.ready.then(fire);
      if (document.readyState !== "complete") window.addEventListener("load", fire, { once: true });
      return () => {
        live = false;
        window.removeEventListener("load", fire);
      };
    },
    setTimeout(callback, ms) {
      const timer = window.setTimeout(callback, ms);
      return () => window.clearTimeout(timer);
    },
  };
}
