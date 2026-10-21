import { describe, expect, it, vi } from "vitest";
import { ANCHOR_SETTLE_MS, anchorIdFrom, keepAnchorInPlace, type AnchorEnvironment } from "@/lib/invitation/hash-anchor";

/**
 * LLEGADA POR ANCLA (`/i/<slug>#regalos`, D-49): el destino se mantiene alineado mientras la página carga (imágenes o fuentes tardías), recibe
 * el foco para los lectores de pantalla y se deja de mover en cuanto la persona interactúa o pasan unos segundos.
 */
function fakeDom(hash: string) {
  const section = { attrs: new Map<string, string>(), focus: vi.fn(), hasAttribute: (name: string) => section.attrs.has(name), setAttribute: (name: string, value: string) => section.attrs.set(name, value) };
  const anchor = { scrollIntoView: vi.fn(), closest: (selector: string) => (selector === "section" ? section : null) };
  const listeners = { layout: [] as Array<() => void>, intent: [] as Array<() => void>, settled: [] as Array<() => void>, timers: [] as Array<() => void> };
  const env: AnchorEnvironment = {
    hash,
    getElementById: (id) => (id === "regalos" ? (anchor as unknown as HTMLElement) : null),
    onLayoutChange: (listener) => (listeners.layout.push(listener), () => (listeners.layout = listeners.layout.filter((l) => l !== listener))),
    onUserIntent: (listener) => (listeners.intent.push(listener), () => (listeners.intent = listeners.intent.filter((l) => l !== listener))),
    onSettled: (listener) => (listeners.settled.push(listener), () => (listeners.settled = listeners.settled.filter((l) => l !== listener))),
    setTimeout: (callback, ms) => {
      expect(ms).toBe(ANCHOR_SETTLE_MS);
      listeners.timers.push(callback);
      return () => (listeners.timers = []);
    },
  };
  const fire = (kind: keyof typeof listeners) => [...listeners[kind]].forEach((listener) => listener());
  return { env, anchor, section, listeners, fire };
}

describe("llegada por ancla", () => {
  it("lee solo ids razonables del hash", () => {
    expect(anchorIdFrom("#regalos")).toBe("regalos");
    expect(anchorIdFrom("")).toBeUndefined();
    expect(anchorIdFrom("#")).toBeUndefined();
    expect(anchorIdFrom("#%E0%A4%A")).toBeUndefined();
    expect(anchorIdFrom("#<img src=x>")).toBeUndefined();
    expect(anchorIdFrom(`#${"a".repeat(80)}`)).toBeUndefined();
  });

  it("da el foco a la sección sin desplazar y la realinea si algo carga tarde por encima", () => {
    const { env, anchor, section, fire } = fakeDom("#regalos");
    keepAnchorInPlace(env);
    expect(section.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(section.attrs.get("tabindex")).toBe("-1");
    fire("layout");
    fire("settled");
    expect(anchor.scrollIntoView).toHaveBeenCalledTimes(2);
    expect(anchor.scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "auto" });
  });

  it("deja de mover la página en cuanto la persona interactúa (nunca pelea con su desplazamiento)", () => {
    const { env, anchor, fire, listeners } = fakeDom("#regalos");
    keepAnchorInPlace(env);
    fire("intent");
    fire("layout");
    expect(anchor.scrollIntoView).not.toHaveBeenCalled();
    expect(listeners.layout).toHaveLength(0);
  });

  it("y como mucho unos segundos después de cargar", () => {
    const { env, anchor, fire } = fakeDom("#regalos");
    keepAnchorInPlace(env);
    fire("timers");
    fire("layout");
    expect(anchor.scrollIntoView).not.toHaveBeenCalled();
  });

  it("sin ancla, con otra o inexistente no hace nada", () => {
    for (const hash of ["", "#otra-seccion", "#<x>"]) {
      const { env, section, listeners } = fakeDom(hash);
      keepAnchorInPlace(env);
      expect(section.focus).not.toHaveBeenCalled();
      expect(listeners.layout).toHaveLength(0);
    }
  });

  it("la invitación lo activa una vez al montarse", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("components/invitation/invitation-shell.tsx", "utf8")).toMatch(/useEffect\(\(\) => keepAnchorInPlace\(browserAnchorEnvironment\(\)\), \[\]\)/);
  });
});
