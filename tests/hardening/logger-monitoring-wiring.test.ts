import { afterEach, describe, expect, it, vi } from "vitest";

const captureException = vi.hoisted(() => vi.fn());
vi.mock("@/server/observability/monitoring", () => ({ captureException }));

import { logger, setLogSink } from "@/server/observability/logger";

afterEach(() => {
  captureException.mockClear();
  vi.unstubAllEnvs();
});

/** (8/9) `logger.error` es el ÚNICO punto que reenvía a Sentry: capturar "excepciones del servidor, fallos de ruta, del webhook y de
 * subida" es automático en cualquier sitio que ya llamaba `logger.error(...)`, sin tocar esos archivos. */
describe("logger.error reenvía a monitoring.captureException", () => {
  const silence = () => setLogSink({ info: () => undefined, warn: () => undefined, error: () => undefined });

  it("con un error, reenvía el error original, el evento y los campos", () => {
    const restore = silence();
    const error = new Error("algo falló");
    logger.error("billing.webhook_failed", error, { type: "checkout.session.completed" });
    restore();
    expect(captureException).toHaveBeenCalledWith(error, "billing.webhook_failed", { type: "checkout.session.completed" });
  });

  it("logger.error SIN un error (solo evento y campos) no llama a monitoring: no hay excepción que reenviar", () => {
    const restore = silence();
    logger.error("algo.paso", undefined, { detail: "sin excepción" });
    restore();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("logger.warn nunca reenvía a monitoring (solo logger.error)", () => {
    const restore = silence();
    logger.warn("rate_limit.provider_error", { rule: "rsvp-client" });
    restore();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("logger.info nunca reenvía a monitoring", () => {
    const restore = silence();
    logger.info("email.sent", { kind: "RSVP_NOTIFICATION" });
    restore();
    expect(captureException).not.toHaveBeenCalled();
  });
});
