import { describe, expect, it, vi } from "vitest";
import { runAfterResponse } from "@/server/email/run-after";

/**
 * (22) Fuera de una petición de Next (como en esta prueba) `after()` lanza: `runAfterResponse` debe capturarlo y ejecutar el
 * efecto de todas formas, sin bloquear a quien lo llamó (no se espera la promesa).
 */
describe("runAfterResponse", () => {
  it("fuera de una petición ejecuta el efecto igualmente (fallback) sin lanzar", () => {
    const effect = vi.fn(async () => undefined);
    expect(() => runAfterResponse(effect)).not.toThrow();
    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("un efecto que falla no se propaga (se atrapa internamente)", async () => {
    const effect = vi.fn(async () => Promise.reject(new Error("boom")));
    expect(() => runAfterResponse(effect)).not.toThrow();
    // Deja que el `.catch` interno se resuelva antes de terminar la prueba.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
