import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { entitlementsForPlan } from "@/lib/billing/entitlements";
import type { PlanId } from "@/lib/billing/plans";
import { templates } from "@/lib/content/templates";
import { invitationToDraftPayload } from "@/lib/editor/draft-payload";
import { createDefaultInvitationData } from "@/lib/events/default-invitation";
import type { OwnedEventResolution } from "@/server/auth/ownership";
import type { GuestRecord } from "@/server/mappers/guest";
import type { GuestWriteResult } from "@/server/repositories/guests";
import { saveInvitationDraft, type DraftServiceDeps } from "@/server/services/draft-service";
import { getEventEntitlements, type EntitlementDeps } from "@/server/services/entitlement-service";
import { createEventForUser, type EventCreationDeps } from "@/server/services/event-creation";
import { createGuestFor, deleteGuestFor, updateGuestFor, type GuestServiceDeps } from "@/server/services/guest-service";
import { addGalleryImage, attachCoverImage, createImageUpload, finalizeImageUpload, removeGalleryImage } from "@/server/services/media-service";
import { checkGalleryLimit, checkGuestLimit, checkTemplatePlanForEvent, checkTemplatePlanForNewEvent, type PlanLimitDeps } from "@/server/services/plan-limits";
import { publishInvitationForOwner, type PublishServiceDeps } from "@/server/services/publish-service";
import { paidPurchase, purchaseWorld } from "../helpers/billing-world";
import { makeWorld, pngBytes } from "../helpers/media-world";

const ROOT = process.cwd();
const code = (file: string) => readFileSync(join(ROOT, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Cada evento tiene SU plan (el de sus compras pagadas). `counts` = uso actual por evento. */
function eventLimits(plans: Record<string, PlanId>, counts: { guests?: Record<string, number>; gallery?: Record<string, number> } = {}) {
  const countGuests = vi.fn(async (_userId: string, eventId: string) => counts.guests?.[eventId] ?? 0);
  const countGalleryImages = vi.fn(async (_userId: string, eventId: string) => counts.gallery?.[eventId] ?? 0);
  const deps: PlanLimitDeps = { eventEntitlements: async (eventId) => entitlementsForPlan(plans[eventId] ?? "FREE"), countGuests, countGalleryImages };
  return { deps, countGuests, countGalleryImages };
}

describe("Límites POR EVENTO (D-32, 30 y 31)", () => {
  it("(74.1) un evento Gratis admite 30 invitados: 29 cabe uno más, 30 no", async () => {
    expect(await checkGuestLimit("u", "evt_A", eventLimits({}, { guests: { evt_A: 29 } }).deps)).toEqual({ ok: true });
    expect(await checkGuestLimit("u", "evt_A", eventLimits({}, { guests: { evt_A: 30 } }).deps)).toMatchObject({ ok: false, code: "limit_reached", limit: "maxGuestsPerEvent", max: 30, message: "Has alcanzado el límite de invitados de este evento." });
  });

  it("(74.2/74.3) Esencial admite 100 y Premium 300", async () => {
    expect(await checkGuestLimit("u", "evt_A", eventLimits({ evt_A: "ESSENTIAL" }, { guests: { evt_A: 99 } }).deps)).toEqual({ ok: true });
    expect(await checkGuestLimit("u", "evt_A", eventLimits({ evt_A: "ESSENTIAL" }, { guests: { evt_A: 100 } }).deps)).toMatchObject({ ok: false, max: 100 });
    expect(await checkGuestLimit("u", "evt_A", eventLimits({ evt_A: "PREMIUM" }, { guests: { evt_A: 299 } }).deps)).toEqual({ ok: true });
    expect(await checkGuestLimit("u", "evt_A", eventLimits({ evt_A: "PREMIUM" }, { guests: { evt_A: 300 } }).deps)).toMatchObject({ ok: false, max: 300 });
  });

  it("(74.4/6) el plan de OTRO evento no afecta: Premium en A y Gratis en B → B sigue con 30", async () => {
    const { deps } = eventLimits({ evt_A: "PREMIUM" }, { guests: { evt_A: 200, evt_B: 30 }, gallery: { evt_A: 30, evt_B: 5 } });
    expect(await checkGuestLimit("u", "evt_A", deps)).toEqual({ ok: true });
    expect(await checkGuestLimit("u", "evt_B", deps)).toMatchObject({ ok: false, max: 30 });
    expect(await checkGalleryLimit("u", "evt_A", deps)).toEqual({ ok: true });
    expect(await checkGalleryLimit("u", "evt_B", deps)).toMatchObject({ ok: false, max: 5 });
  });

  it("(74.5) galería por evento: Gratis 5, Esencial 15, Premium 40", async () => {
    expect(await checkGalleryLimit("u", "e", eventLimits({}, { gallery: { e: 4 } }).deps)).toEqual({ ok: true });
    expect(await checkGalleryLimit("u", "e", eventLimits({}, { gallery: { e: 5 } }).deps)).toMatchObject({ ok: false, max: 5, message: "Has alcanzado el límite de imágenes de la galería de este evento." });
    expect(await checkGalleryLimit("u", "e", eventLimits({ e: "ESSENTIAL" }, { gallery: { e: 15 } }).deps)).toMatchObject({ ok: false, max: 15 });
    expect(await checkGalleryLimit("u", "e", eventLimits({ e: "PREMIUM" }, { gallery: { e: 39 } }).deps)).toEqual({ ok: true });
    expect(await checkGalleryLimit("u", "e", eventLimits({ e: "PREMIUM" }, { gallery: { e: 40 } }).deps)).toMatchObject({ ok: false, max: 40 });
  });

  it("los límites reales leen las compras PAID de ESE evento en la base de datos (integración con el servicio de derechos)", async () => {
    const w = purchaseWorld({ events: { evt_A: { ownerId: "usr_A", startsAt: new Date("2027-05-17T23:00:00Z") }, evt_B: { ownerId: "usr_A", startsAt: new Date("2027-08-01T20:00:00Z") } }, purchases: [paidPurchase({ eventId: "evt_A", plan: "PREMIUM", kind: "INITIAL" })] });
    const entitlementDeps: EntitlementDeps = { findEventBilling: async (id) => w.state(id), findOwnedEventBilling: async () => null, now: () => new Date("2027-03-01T00:00:00Z") };
    const deps: PlanLimitDeps = { eventEntitlements: (id) => getEventEntitlements(id, entitlementDeps), countGuests: async () => 250, countGalleryImages: async () => 0 };
    expect(await checkGuestLimit("usr_A", "evt_A", deps)).toEqual({ ok: true });
    expect(await checkGuestLimit("usr_A", "evt_B", deps)).toMatchObject({ ok: false, max: 30 });
  });

  it("(32/33) Template.minimumPlan es un plan mínimo DE EVENTO: un evento Gratis no usa una plantilla Premium; uno Premium sí", async () => {
    expect(await checkTemplatePlanForEvent("e", "FREE", eventLimits({}).deps)).toEqual({ ok: true });
    expect(await checkTemplatePlanForEvent("e", "PREMIUM", eventLimits({}).deps)).toMatchObject({ ok: false, code: "plan_required", minimumPlan: "PREMIUM", message: "Esta plantilla requiere Premium para este evento." });
    expect(await checkTemplatePlanForEvent("e", "PREMIUM", eventLimits({ e: "PREMIUM" }).deps)).toEqual({ ok: true });
    expect(checkTemplatePlanForNewEvent("FREE")).toEqual({ ok: true });
    expect(checkTemplatePlanForNewEvent("ESSENTIAL")).toMatchObject({ ok: false, code: "plan_required" });
  });
});

describe("createEventForUser: sin límite de eventos, el evento nace Gratis (28, 29)", () => {
  const user = { id: "usr_A", email: "a@example.com", name: "A" };
  const good = { templateSlug: "magnolia", eventType: "wedding", name1: "Andrea", name2: "Fernando", date: "2027-05-17", time: "17:00", timezone: "America/Mexico_City" };

  function world(catalog = templates) {
    const created: string[] = [];
    let n = 0;
    const deps: EventCreationDeps = {
      findTemplate: async (slug) => catalog.find((template) => template.slug === slug),
      findTakenSlugs: async () => ({ event: new Set(), invitation: new Set() }),
      create: async (ownerId, aggregate) => {
        created.push(ownerId);
        return { eventId: aggregate.event.id, invitationId: aggregate.invitation.invitation.id };
      },
      newId: (prefix) => `${prefix}_${++n}`,
      checkTemplatePlan: checkTemplatePlanForNewEvent,
    };
    return { deps, created };
  }

  it("(29) crear un evento nunca pregunta por un cupo de eventos: se pueden crear muchos, todos Gratis", async () => {
    const { deps, created } = world();
    for (let i = 0; i < 5; i += 1) expect((await createEventForUser(user, good, deps)).ok).toBe(true);
    expect(created).toHaveLength(5);
    expect(Object.keys(deps)).not.toContain("checkEventLimit");
    expect(code("server/services/event-creation.ts")).not.toMatch(/checkEventLimit|maxEvents|limit_reached/);
  });

  it("(32) una plantilla Premium no se puede usar en un evento nuevo (nace Gratis): plan_required sin escribir nada", async () => {
    const premiumCatalog = templates.map((template) => (template.slug === "magnolia" ? { ...template, minimumPlan: "PREMIUM" as const } : template));
    const blocked = world(premiumCatalog);
    expect(await createEventForUser(user, good, blocked.deps)).toMatchObject({ ok: false, code: "plan_required", message: "Esta plantilla requiere Premium para este evento." });
    expect(blocked.created).toHaveLength(0);
  });

  it("Magnolia es plan mínimo FREE", () => {
    expect(templates.find((template) => template.slug === "magnolia")?.minimumPlan).toBe("FREE");
  });
});

describe("Guest service: el límite es el del evento; nada existente se toca", () => {
  const record: GuestRecord = { id: "gst_1", name: "Ana", email: null, phone: null, groupId: null, groupName: null, maxCompanions: 0, status: "PENDING", inviteToken: "t".repeat(32), createdAt: new Date(), attendeeCount: null };

  function guestWorld(plan: PlanId, guests: number) {
    const { deps: planDeps } = eventLimits({ evt_A: plan }, { guests: { evt_A: guests } });
    const create = vi.fn(async (): Promise<GuestWriteResult> => ({ ok: true, guest: record }));
    const update = vi.fn(async (): Promise<GuestWriteResult> => ({ ok: true, guest: record }));
    const remove = vi.fn(async () => true);
    const deps: GuestServiceDeps = {
      resolveOwnedEvent: async (): Promise<OwnedEventResolution> => ({ status: "ok", user: { id: "usr_A", email: "a@example.com", name: "A" }, event: { id: "evt_A", slug: "a", title: "A", type: "wedding", status: "active", startsAt: "2027-01-01T00:00:00Z", timezone: "UTC" } }),
      create,
      update,
      remove,
      checkGuestLimit: (userId, eventId) => checkGuestLimit(userId, eventId, planDeps),
    };
    return { deps, create, update, remove };
  }

  it("(30) con 30 de 30 en un evento Gratis el alta se rechaza en el servidor y no se crea nada", async () => {
    const { deps, create } = guestWorld("FREE", 30);
    expect((await createGuestFor("evt_A", { name: "Nuevo" }, deps)).result).toEqual({ ok: false, code: "limit_reached", message: "Has alcanzado el límite de invitados de este evento." });
    expect(create).not.toHaveBeenCalled();
  });

  it("(D) el mismo evento, ya Esencial, permite pasar de 30 hasta 100", async () => {
    const { deps, create } = guestWorld("ESSENTIAL", 31);
    expect((await createGuestFor("evt_A", { name: "Nuevo" }, deps)).result.ok).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("(46/79) un evento por encima de su límite (p. ej. tras un reembolso) conserva TODO: se puede editar y eliminar, pero no añadir", async () => {
    const { deps, create, update, remove } = guestWorld("FREE", 80);
    expect((await updateGuestFor("evt_A", "gst_1", { name: "Ana López" }, deps)).result.ok).toBe(true);
    expect((await deleteGuestFor("evt_A", "gst_1", deps)).result.ok).toBe(true);
    expect((await createGuestFor("evt_A", { name: "Uno más" }, deps)).result).toMatchObject({ ok: false, code: "limit_reached" });
    expect(update).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("Galería por evento (la portada no cuenta)", () => {
  async function upload(world: ReturnType<typeof makeWorld>) {
    const bytes = pngBytes(1200, 800);
    const requested = await createImageUpload("evt_A", { filename: "foto.png", mimeType: "image/png", sizeBytes: bytes.byteLength }, world.deps);
    if (!requested.result.ok) throw new Error(requested.result.message);
    const id = requested.result.upload.mediaAssetId;
    world.storage.put(world.repo.assets.get(id)!.storageKey, bytes);
    await finalizeImageUpload("evt_A", id, world.deps);
    return id;
  }

  function galleryWorld(plan: PlanId) {
    const world = makeWorld("usr_A");
    const galleryOf = () => world.repo.gallery.filter((row) => row.eventId === "evt_A").length;
    const { deps: planDeps } = eventLimits({ evt_A: plan });
    world.deps.checkGalleryLimit = (userId, eventId) => checkGalleryLimit(userId, eventId, { ...planDeps, countGalleryImages: async () => galleryOf() });
    return { world, galleryOf };
  }

  it("(31) en un evento Gratis con 5 de 5 (una estática + 4 propias) la sexta se rechaza y el archivo queda sin asociar", async () => {
    const { world, galleryOf } = galleryWorld("FREE");
    for (let i = 0; i < 4; i += 1) expect((await addGalleryImage("evt_A", await upload(world), "", world.deps)).result.ok).toBe(true);
    const extra = await upload(world);
    expect((await addGalleryImage("evt_A", extra, "", world.deps)).result).toMatchObject({ ok: false, code: "limit_reached" });
    expect(galleryOf()).toBe(5);
    expect(world.repo.assets.get(extra)?.status).toBe("READY");
  });

  it("el mismo evento como Esencial admite hasta 15", async () => {
    const { world, galleryOf } = galleryWorld("ESSENTIAL");
    for (let i = 0; i < 10; i += 1) expect((await addGalleryImage("evt_A", await upload(world), "", world.deps)).result.ok).toBe(true);
    expect(galleryOf()).toBe(11);
  });

  it("la portada no está sujeta al límite de galería", async () => {
    const { world } = galleryWorld("FREE");
    for (let i = 0; i < 4; i += 1) await addGalleryImage("evt_A", await upload(world), "", world.deps);
    expect((await attachCoverImage("evt_A", await upload(world), "portada", world.deps)).result.ok).toBe(true);
  });

  it("(79) sobre el límite se puede QUITAR una imagen; ningún archivo se borra por el plan", async () => {
    const { world } = galleryWorld("FREE");
    for (let i = 0; i < 4; i += 1) await addGalleryImage("evt_A", await upload(world), "", world.deps);
    world.repo.gallery.push({ id: "gal_x", eventId: "evt_A", assetId: null, src: "/x.png", alt: "", position: 9 });
    expect((await addGalleryImage("evt_A", await upload(world), "", world.deps)).result).toMatchObject({ ok: false, code: "limit_reached" });
    expect(world.storage.deleted).toHaveLength(0);
    expect((await removeGalleryImage("evt_A", "gal_x", world.deps)).result.ok).toBe(true);
  });
});

describe("Publicar y cambiar de plantilla son por EVENTO (34, 35)", () => {
  const owned = async (): Promise<OwnedEventResolution> => ({ status: "ok", user: { id: "usr_A", email: "a@example.com", name: "A" }, event: { id: "evt_A", slug: "s", title: "S", type: "wedding", status: "draft", startsAt: "2027-05-17T23:00:00Z", timezone: "America/Mexico_City" } });

  it("publicar consulta la feature del EVENTO (no del usuario); sin la feature responde plan_required sin publicar", async () => {
    const publish = vi.fn();
    const asked: string[] = [];
    const base = { resolveOwnedEvent: owned, publish, templateConfig: () => undefined, release: async () => undefined, getMeta: async () => undefined } as unknown as PublishServiceDeps;
    const denied = await publishInvitationForOwner("evt_A", {}, { ...base, canUseEventFeature: async (eventId, feature) => (asked.push(`${eventId}:${feature}`), false) });
    expect(denied.result).toMatchObject({ ok: false, code: "plan_required", message: "El plan de este evento no incluye publicar la invitación." });
    expect(asked).toEqual(["evt_A:publish"]);
    expect(publish).not.toHaveBeenCalled();
  });

  it("al cambiar de plantilla el servicio pasa la comprobación ligada al EVENTO; sin permiso responde plan_required con «Mejorar evento»", async () => {
    const fresh = () => createDefaultInvitationData({ eventType: "wedding", templateSlug: "magnolia", names: ["Sofía", "Diego"], startsAtIso: "2027-05-17T17:00:00-06:00", timezone: "America/Mexico_City", invitationSlug: "sofia-y-diego" });
    const asked: string[] = [];
    const deps: DraftServiceDeps = {
      resolveOwnedEvent: owned,
      save: async (_userId, _eventId, _base, _build, templateAccess) => ((await templateAccess?.("PREMIUM")) ? { ok: true, revision: 6, releasedMediaIds: [] } : { ok: false, code: "plan_required" }),
      release: async () => undefined,
      canSelectTemplate: () => true,
      templatePlanAllowed: async (eventId, minimum) => {
        asked.push(`${eventId}:${minimum}`);
        return (await checkTemplatePlanForEvent(eventId, minimum, eventLimits({}).deps)).ok;
      },
    };
    const payload = invitationToDraftPayload(fresh(), 5);
    expect(await saveInvitationDraft("evt_A", payload, deps)).toEqual({ ok: false, code: "plan_required", message: "Esta plantilla requiere un plan superior para este evento. Mejora tu evento para usarla." });
    expect(asked).toEqual(["evt_A:PREMIUM"]);
    const premium: DraftServiceDeps = { ...deps, templatePlanAllowed: async (eventId, minimum) => (await checkTemplatePlanForEvent(eventId, minimum, eventLimits({ evt_A: "PREMIUM" }).deps)).ok };
    expect(await saveInvitationDraft("evt_A", payload, premium)).toEqual({ ok: true, revision: 6 });
  });

  it("guardar cualquier otra edición NO consulta el plan: solo se pregunta al CAMBIAR de plantilla", () => {
    const repo = code("server/repositories/draft.ts");
    expect(repo).toMatch(/if \(next\.templateSlug !== current\.templateSlug\) \{[\s\S]*?templateAccess\(template\.minimumPlan\)[\s\S]*?\}\n/);
    expect((repo.match(/templateAccess\(/g) ?? []).length).toBe(1);
  });
});

describe("El plan ya no es de la cuenta (1, 12)", () => {
  const walk = (path: string): string[] => (statSync(path).isDirectory() ? readdirSync(path).flatMap((name) => walk(join(path, name))) : /\.(ts|tsx)$/.test(path) ? [path] : []);

  it("no queda ningún servicio de derechos por USUARIO: ni getUserPlan/getUserEntitlements/canUseFeature ni límite de eventos", () => {
    const files = ["server", "app", "components", "lib"].flatMap((dir) => walk(join(ROOT, dir)));
    for (const file of files) expect(code(relative(ROOT, file)), relative(ROOT, file)).not.toMatch(/getUserPlan|getUserEntitlements|\bcanUseFeature\(|maxEvents|checkEventLimit|countOwnedEvents/);
  });

  it("el gating por plan siempre recibe un eventId (nunca un userId) en los servicios de casos de uso", () => {
    expect(code("server/services/entitlement-service.ts")).not.toMatch(/\(userId: string, feature/);
    expect(code("server/services/plan-limits.ts")).toMatch(/eventEntitlements: \(eventId: string\)/);
  });
});

describe("Ninguna operación de facturación borra contenido (79, 46, 57)", () => {
  const walk = (path: string): string[] => (statSync(path).isDirectory() ? readdirSync(path).flatMap((name) => walk(join(path, name))) : [path]);

  it("ningún módulo de facturación ni de límites contiene operaciones de borrado de eventos, invitaciones, invitados, RSVP o archivos", () => {
    const files = ["server/billing", "server/services/billing-service.ts", "server/services/billing-webhook.ts", "server/services/purchase-sync.ts", "server/services/entitlement-service.ts", "server/services/plan-limits.ts", "server/repositories/billing.ts", "server/repositories/usage.ts", "lib/billing"].flatMap((entry) => walk(join(ROOT, entry)));
    for (const file of files) expect(code(relative(ROOT, file)), relative(ROOT, file)).not.toMatch(/\.delete\(|\.deleteMany\(|\bDELETE\b|\.unlink|storage\(\)\??\.delete|markDeleted/);
  });

  it("el repositorio de facturación solo escribe EventPurchase, BillingCustomer, WebhookEvent y el fin de acceso del Event", () => {
    const source = code("server/repositories/billing.ts");
    const tables = [...source.matchAll(/(?:tx|prisma)\.(\w+)\.(?:create|createMany|upsert|update|updateMany)\(/g)].map((match) => match[1]);
    expect(new Set(tables)).toEqual(new Set(["billingCustomer", "webhookEvent", "eventPurchase", "event"]));
    // El único update del evento es el fin del acceso pagado.
    expect(source).toMatch(/tx\.event\.update\(\{ where: \{ id: eventId \}, data: \{ paidAccessEndsAt: end \} \}\)/);
  });

  it("la tabla legacy Subscription no se lee ni se escribe en ningún sitio del código", () => {
    const files = ["server", "app", "components", "lib"].flatMap((dir) => walk(join(ROOT, dir))).filter((file) => /\.(ts|tsx)$/.test(file));
    for (const file of files) expect(code(relative(ROOT, file)), relative(ROOT, file)).not.toMatch(/prisma\.subscription|tx\.subscription/);
  });

  it("(70/71) el RSVP público y la lectura del contenido no consultan el plan: un evento sobre su límite sigue recibiendo respuestas", () => {
    for (const file of ["server/services/public-rsvp.ts", "server/services/public-rsvp-runtime.ts", "server/repositories/guest-response.ts", "server/repositories/guests.ts"]) {
      expect(code(file), file).not.toMatch(/plan-limits|entitlement|billing/i);
    }
  });
});
