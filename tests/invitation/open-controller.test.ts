import { describe, expect, it, vi } from "vitest";
import { createOpenController } from "@/lib/invitation/open-controller";

describe("controlador de «Abrir invitación» (enganche para la música futura)", () => {
  it("empieza cerrada y abre una sola vez", () => {
    const controller = createOpenController();
    expect(controller.isOpened()).toBe(false);
    expect(controller.open()).toBe(true);
    expect(controller.isOpened()).toBe(true);
    expect(controller.open()).toBe(false);
  });

  it("avisa a los suscriptores de forma síncrona dentro de open() y en orden", () => {
    const controller = createOpenController();
    const calls: string[] = [];
    controller.subscribe(() => calls.push("primero"));
    controller.subscribe(() => calls.push("segundo"));

    controller.open();
    calls.push("después de open()");

    expect(calls).toEqual(["primero", "segundo", "después de open()"]);
  });

  it("solo avisa una vez aunque se pulse varias veces", () => {
    const controller = createOpenController();
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.open();
    controller.open();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("cancelar la suscripción evita el aviso", () => {
    const controller = createOpenController();
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    unsubscribe();
    controller.open();
    expect(listener).not.toHaveBeenCalled();
  });

  it("sin suscriptores (estado actual: no hay música) abrir no hace nada más", () => {
    expect(() => createOpenController().open()).not.toThrow();
  });
});
