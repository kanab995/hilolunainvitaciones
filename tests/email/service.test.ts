import { afterEach, describe, expect, it, vi } from "vitest";
import type { EmailProvider, EmailProviderState, EmailSendResult } from "@/server/email/provider";
import { retryFailedEmailDelivery, sendPurchaseConfirmation, sendRsvpNotification, sendUpgradeConfirmation, type EmailServiceDeps } from "@/server/email/service";
import type { CreateDeliveryInput, CreateDeliveryResult, EventOwnerContext, GuestRsvpContext, PurchaseForRetry } from "@/server/repositories/email-delivery";

const EVENT_URL = "https://hiloluna.test";

function world(over: Partial<EmailServiceDeps> = {}) {
  const sent: Array<{ to: string; subject: string }> = [];
  const marks = { sent: [] as unknown[], failed: [] as unknown[], skipped: [] as unknown[] };
  let nextId = 1;
  const attempts = new Set<string>(); // simula la restricción única (kind|purchaseId)

  const provider: EmailProvider = { id: "resend", send: vi.fn(async (message) => (sent.push({ to: message.to, subject: message.subject }), { ok: true, providerMessageId: "resend_1" }) as EmailSendResult) };
  const providerState: EmailProviderState = { status: "ready", provider };

  const guestContext: GuestRsvpContext = { eventId: "evt_1", eventTitle: "Andrea & Fernando", ownerId: "usr_1", ownerEmail: "owner@example.com", ownerName: "Owner", guestName: "Mariana López" };
  const eventContext: EventOwnerContext = { eventId: "evt_1", eventTitle: "Andrea & Fernando", ownerId: "usr_1", ownerEmail: "owner@example.com", ownerName: "Owner" };

  const deps: EmailServiceDeps = {
    getProviderState: () => providerState,
    resolveGuestRsvpContext: vi.fn(async () => guestContext),
    resolveEventOwnerContext: vi.fn(async () => eventContext),
    findPurchaseIdBySession: vi.fn(async () => "purch_1"),
    createEmailDeliveryAttempt: vi.fn(async (input: CreateDeliveryInput): Promise<CreateDeliveryResult> => {
      const key = `${input.kind}|${input.purchaseId ?? "null"}`;
      if (input.purchaseId && attempts.has(key)) return { status: "duplicate" };
      if (input.purchaseId) attempts.add(key);
      return { status: "created", id: `del_${nextId++}` };
    }),
    markEmailDeliverySent: vi.fn(async (id, providerMessageId) => void marks.sent.push({ id, providerMessageId })),
    markEmailDeliveryFailed: vi.fn(async (id, errorCode) => void marks.failed.push({ id, errorCode })),
    markEmailDeliverySkipped: vi.fn(async (id, reasonCode) => void marks.skipped.push({ id, reasonCode })),
    findFailedEmailDelivery: vi.fn(async () => null),
    findPurchaseForRetry: vi.fn(async () => null),
    reopenEmailDeliveryForRetry: vi.fn(async () => undefined),
    isRecipientAllowedInStaging: vi.fn(() => true),
    withStagingSubjectPrefix: vi.fn((subject: string) => subject),
    siteUrl: () => EVENT_URL,
    ...over,
  };
  return { deps, sent, marks, provider };
}

afterEach(() => vi.useRealTimers());

describe("(47.1/47.4) sendRsvpNotification", () => {
  it("resuelve el contexto, envía y marca SENT", async () => {
    const { deps, sent, marks } = world();
    await sendRsvpNotification({ eventId: "evt_1", guestId: "gst_1", status: "ATTENDING", attendeeCount: 2 }, deps);
    expect(sent).toEqual([{ to: "owner@example.com", subject: "Mariana López confirmó su asistencia" }]);
    expect(marks.sent).toHaveLength(1);
    expect(deps.createEmailDeliveryAttempt).toHaveBeenCalledWith(expect.objectContaining({ kind: "RSVP_NOTIFICATION", recipientUserId: "usr_1", eventId: "evt_1" }));
  });

  it("si el invitado ya no existe, no crea ningún intento de envío", async () => {
    const { deps } = world({ resolveGuestRsvpContext: vi.fn(async () => null) });
    await sendRsvpNotification({ eventId: "evt_1", guestId: "gst_x", status: "ATTENDING", attendeeCount: 1 }, deps);
    expect(deps.createEmailDeliveryAttempt).not.toHaveBeenCalled();
  });

  it("(47.2) un fallo al resolver el contexto se registra y NUNCA se propaga", async () => {
    const { deps } = world({ resolveGuestRsvpContext: vi.fn(async () => Promise.reject(new Error("db caída"))) });
    await expect(sendRsvpNotification({ eventId: "evt_1", guestId: "gst_1", status: "ATTENDING", attendeeCount: 1 }, deps)).resolves.toBeUndefined();
  });
});

describe("(48.1/48.2/48.3/48.4/48.5) sendPurchaseConfirmation / sendUpgradeConfirmation", () => {
  const purchase = { eventId: "evt_1", provider: "STRIPE" as const, checkoutSessionId: "cs_1", plan: "ESSENTIAL" as const, amountMinor: 49900, currency: "MXN", paidAt: new Date("2027-01-01T00:00:00Z"), accessEndsAt: null };

  it("(48.1) una compra PAID envía la confirmación con el importe real (499)", async () => {
    const { deps, sent } = world();
    await sendPurchaseConfirmation(purchase, deps);
    expect(sent[0]).toMatchObject({ to: "owner@example.com", subject: "Tu evento ya tiene Hilo Luna Esencial" });
    expect(deps.createEmailDeliveryAttempt).toHaveBeenCalledWith(expect.objectContaining({ kind: "PURCHASE_CONFIRMATION", purchaseId: "purch_1" }));
  });

  it("(48.5) el upgrade envía «ahora es Premium» con la diferencia (300), no el precio completo", async () => {
    const { deps, sent } = world();
    await sendUpgradeConfirmation({ ...purchase, plan: "PREMIUM", amountMinor: 30000 }, deps);
    expect(sent[0]?.subject).toBe("Tu evento ahora es Premium");
  });

  it("(48.2) el webhook repetido no duplica el correo: la segunda llamada para la MISMA compra no manda nada", async () => {
    const { deps, sent } = world();
    await sendPurchaseConfirmation(purchase, deps);
    await sendPurchaseConfirmation(purchase, deps);
    expect(sent).toHaveLength(1);
  });

  it("distinto tipo (confirmación vs mejora) para la MISMA compra sí puede enviarse (kind distinto en la clave)", async () => {
    const { deps, sent } = world();
    await sendPurchaseConfirmation(purchase, deps);
    await sendUpgradeConfirmation(purchase, deps);
    expect(sent).toHaveLength(2);
  });

  it("sin evento o sin compra resuelta, no se crea ningún intento", async () => {
    const noEvent = world({ resolveEventOwnerContext: vi.fn(async () => null) });
    await sendPurchaseConfirmation(purchase, noEvent.deps);
    expect(noEvent.deps.createEmailDeliveryAttempt).not.toHaveBeenCalled();

    const noPurchase = world({ findPurchaseIdBySession: vi.fn(async () => null) });
    await sendPurchaseConfirmation(purchase, noPurchase.deps);
    expect(noPurchase.deps.createEmailDeliveryAttempt).not.toHaveBeenCalled();
  });
});

describe("(19/27) omitido (SKIPPED): sin proveedor, config inválida, fuera de la lista de staging", () => {
  it("sin proveedor configurado: SKIPPED con motivo not_configured, sin enviar", async () => {
    const { deps, sent, marks } = world({ getProviderState: () => ({ status: "not_configured" }) });
    await sendRsvpNotification({ eventId: "evt_1", guestId: "gst_1", status: "ATTENDING", attendeeCount: 1 }, deps);
    expect(sent).toHaveLength(0);
    expect(marks.skipped).toEqual([{ id: "del_1", reasonCode: "not_configured" }]);
  });

  it("configuración inválida: SKIPPED con motivo invalid_config", async () => {
    const { deps, marks } = world({ getProviderState: () => ({ status: "invalid", problems: ["EMAIL_FROM"] }) });
    await sendRsvpNotification({ eventId: "evt_1", guestId: "gst_1", status: "ATTENDING", attendeeCount: 1 }, deps);
    expect(marks.skipped).toEqual([{ id: "del_1", reasonCode: "invalid_config" }]);
  });

  it("(27) destinatario fuera de la lista de staging: SKIPPED, nunca se llama al proveedor", async () => {
    const { deps, sent, marks, provider } = world({ isRecipientAllowedInStaging: vi.fn(() => false) });
    await sendRsvpNotification({ eventId: "evt_1", guestId: "gst_1", status: "ATTENDING", attendeeCount: 1 }, deps);
    expect(provider.send).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
    expect(marks.skipped).toEqual([{ id: "del_1", reasonCode: "staging_not_allowlisted" }]);
  });

  it("(28) el asunto lleva el prefijo que decida withStagingSubjectPrefix", async () => {
    const { deps, sent } = world({ withStagingSubjectPrefix: vi.fn((subject: string) => `[STAGING] ${subject}`) });
    await sendRsvpNotification({ eventId: "evt_1", guestId: "gst_1", status: "ATTENDING", attendeeCount: 1 }, deps);
    expect(sent[0]?.subject).toMatch(/^\[STAGING\] /);
  });
});

describe("(11/22) fallo del proveedor y temporización", () => {
  it("el proveedor responde ok:false: se marca FAILED con el código, sin lanzar", async () => {
    const provider: EmailProvider = { id: "resend", send: vi.fn(async (): Promise<EmailSendResult> => ({ ok: false, errorCode: "invalid_recipient" })) };
    const { deps, marks } = world({ getProviderState: () => ({ status: "ready", provider }) });
    await expect(sendRsvpNotification({ eventId: "evt_1", guestId: "gst_1", status: "ATTENDING", attendeeCount: 1 }, deps)).resolves.toBeUndefined();
    expect(marks.failed).toEqual([{ id: "del_1", errorCode: "invalid_recipient" }]);
  });

  it("(22) un envío que se queda colgado se corta por tiempo: se marca FAILED y la función no se queda esperando para siempre", async () => {
    vi.useFakeTimers();
    const provider: EmailProvider = { id: "resend", send: vi.fn(() => new Promise<EmailSendResult>(() => {})) };
    const { deps, marks } = world({ getProviderState: () => ({ status: "ready", provider }) });
    const pending = sendRsvpNotification({ eventId: "evt_1", guestId: "gst_1", status: "ATTENDING", attendeeCount: 1 }, deps);
    await vi.advanceTimersByTimeAsync(8_001);
    await pending;
    expect(marks.failed).toEqual([{ id: "del_1", errorCode: "EmailTimeoutError" }]);
  });
});

describe("(21/40) retryFailedEmailDelivery: preparado, sin interfaz — solo compra/mejora", () => {
  it("fila inexistente o ya no FAILED → not_found", async () => {
    const { deps } = world({ findFailedEmailDelivery: vi.fn(async () => null) });
    expect(await retryFailedEmailDelivery("del_x", deps)).toBe("not_found");
  });

  it("RSVP_NOTIFICATION → unsupported (decisión documentada en docs/EMAIL.md)", async () => {
    const { deps } = world({ findFailedEmailDelivery: vi.fn(async () => ({ id: "del_1", kind: "RSVP_NOTIFICATION" as const, recipientUserId: "usr_1", eventId: "evt_1", purchaseId: null, rsvpId: "rsvp_1", status: "FAILED" as const })) });
    expect(await retryFailedEmailDelivery("del_1", deps)).toBe("unsupported");
  });

  it("compra no pagada (ya no PAID) → not_paid, sin reabrir la fila", async () => {
    const purchase: PurchaseForRetry = { eventId: "evt_1", provider: "STRIPE", checkoutSessionId: "cs_1", plan: "ESSENTIAL", kind: "INITIAL", amount: 49900, currency: "MXN", paidAt: new Date(), accessEndsAt: null, status: "REFUNDED" };
    const { deps } = world({
      findFailedEmailDelivery: vi.fn(async () => ({ id: "del_1", kind: "PURCHASE_CONFIRMATION" as const, recipientUserId: "usr_1", eventId: "evt_1", purchaseId: "purch_1", rsvpId: null, status: "FAILED" as const })),
      findPurchaseForRetry: vi.fn(async () => purchase),
    });
    expect(await retryFailedEmailDelivery("del_1", deps)).toBe("not_paid");
    expect(deps.reopenEmailDeliveryForRetry).not.toHaveBeenCalled();
  });

  it("compra PAID: reabre la MISMA fila (no crea una nueva) y reenvía con los datos actuales", async () => {
    const purchase: PurchaseForRetry = { eventId: "evt_1", provider: "STRIPE", checkoutSessionId: "cs_1", plan: "PREMIUM", kind: "UPGRADE", amount: 30000, currency: "MXN", paidAt: new Date("2027-03-01T00:00:00Z"), accessEndsAt: null, status: "PAID" };
    const { deps, sent } = world({
      findFailedEmailDelivery: vi.fn(async () => ({ id: "del_9", kind: "UPGRADE_CONFIRMATION" as const, recipientUserId: "usr_1", eventId: "evt_1", purchaseId: "purch_1", rsvpId: null, status: "FAILED" as const })),
      findPurchaseForRetry: vi.fn(async () => purchase),
    });
    expect(await retryFailedEmailDelivery("del_9", deps)).toBe("retried");
    expect(deps.reopenEmailDeliveryForRetry).toHaveBeenCalledWith("del_9");
    expect(deps.createEmailDeliveryAttempt).not.toHaveBeenCalled();
    expect(sent[0]?.subject).toBe("Tu evento ahora es Premium");
  });
});
