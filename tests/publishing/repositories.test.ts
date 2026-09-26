import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invitationToDraftPayload, parseDraftPayload, applyDraftPayload } from "@/lib/editor/draft-payload";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { magnoliaTemplate } from "@/lib/invitation/templates/magnolia";
import { buildPublishedInvitationSnapshot } from "@/lib/publishing/snapshot";
import { getDemoRows } from "@/server/repositories/demo-store";

/**
 * Repositorios de borrador y publicación con Prisma sustituido por un doble que captura cada operación y el
 * cliente (transacción o raíz) por el que pasa. La comprobación con PostgreSQL real está en el informe.
 */
const log = vi.hoisted(() => ({
  calls: [] as { client: "tx" | "root"; op: string; args: Record<string, unknown> }[],
  row: undefined as unknown,
  head: undefined as unknown,
  casCount: 1,
  previous: undefined as unknown,
  template: { id: "tpl_1" } as unknown,
  assets: [] as unknown[],
  failOn: undefined as string | undefined,
}));

const op = (client: "tx" | "root", name: string, result: unknown = {}) =>
  vi.fn(async (args: Record<string, unknown>) => {
    log.calls.push({ client, op: name, args });
    if (log.failOn === name) throw Object.assign(new Error("unique"), { code: "P2002", meta: { target: ["id"] } });
    return typeof result === "function" ? (result as (a: Record<string, unknown>) => unknown)(args) : result;
  });

vi.mock("@/server/db/client", () => {
  const tx = () => ({
    invitation: {
      findFirst: op("tx", "inv.findFirst", () => log.row),
      updateMany: op("tx", "inv.updateMany", () => ({ count: log.casCount })),
      update: op("tx", "inv.update"),
      findUnique: op("tx", "inv.findUnique", () => ({ publishedVersion: 9, draftRevision: 4 })),
    },
    event: { update: op("tx", "event.update") },
    template: { findFirst: op("tx", "tpl.findFirst", () => log.template) },
    invitationSection: { updateMany: op("tx", "section.updateMany") },
    location: { updateMany: op("tx", "loc.updateMany"), create: op("tx", "loc.create"), deleteMany: op("tx", "loc.deleteMany") },
    timelineItem: { updateMany: op("tx", "tl.updateMany"), create: op("tx", "tl.create"), deleteMany: op("tx", "tl.deleteMany") },
    giftRegistry: { updateMany: op("tx", "gift.updateMany"), create: op("tx", "gift.create"), deleteMany: op("tx", "gift.deleteMany") },
    galleryImage: { updateMany: op("tx", "gal.updateMany") },
    musicSettings: { upsert: op("tx", "music.upsert"), deleteMany: op("tx", "music.deleteMany") },
    mediaAsset: { findMany: op("tx", "asset.findMany", () => log.assets) },
    invitationPublication: { findFirst: op("tx", "pub.findFirst", () => log.previous ?? null), updateMany: op("tx", "pub.updateMany"), create: op("tx", "pub.create") },
  });
  const root = new Proxy(
    {},
    {
      get: (_t, key) => {
        if (key === "$transaction") return async (cb: (client: unknown) => unknown) => cb(tx());
        if (key === "invitation") return { findFirst: op("root", "root.inv.findFirst", (args: Record<string, unknown>) => (args.include ? log.row : log.head)) };
        if (key === "guest") return { findFirst: op("root", "root.guest.findFirst", () => ({ id: "g1", name: "Mariana", maxCompanions: 2, status: "ATTENDING", group: null, rsvp: { status: "ATTENDING", attendeeCount: 2, message: "hola", answers: [] } })) };
        if (key === "rsvpQuestion") return { findMany: op("root", "root.q.findMany", []) };
        return new Proxy({}, { get: (_x, method) => op("root", `root.${String(key)}.${String(method)}`) });
      },
    },
  );
  return { prisma: root };
});

import { saveOwnedDraft } from "@/server/repositories/draft";
import { getPublicInvitationRecord, resolveRsvpTarget } from "@/server/repositories/public-invitations";
import { loadPublishedInvitation, publishOwnedInvitation, type PublishedRecord } from "@/server/repositories/publishing";

const NOW = new Date("2026-09-26T12:00:00Z");
const baseRow = (over: Record<string, unknown> = {}) => ({ ...getDemoRows(NOW).invitation, eventId: "evt_1", draftRevision: 5, publishedRevision: 0, publishedVersion: 0, publishedAt: null, coverMediaId: null, coverAlt: "", status: "DRAFT", event: { ...getDemoRows(NOW).invitation.event, type: "WEDDING", title: "Andrea & Fernando" }, ...over });

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://prueba");
  log.calls.length = 0;
  log.row = baseRow();
  log.head = undefined;
  log.casCount = 1;
  log.previous = undefined;
  log.template = { id: "tpl_1" };
  log.assets = [];
  log.failOn = undefined;
});
afterEach(() => vi.unstubAllEnvs());

const ops = () => log.calls.map((call) => call.op);
const where = (name: string) => log.calls.find((call) => call.op === name)?.args.where as Record<string, unknown>;
const parseFor = (invitation = andreaFernandoInvitation, revision = 5, patch: Record<string, unknown> = {}) => {
  const parsed = parseDraftPayload({ ...invitationToDraftPayload(invitation, revision), ...patch });
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.value;
};
const buildFrom = (dto: ReturnType<typeof parseFor>) => (current: typeof andreaFernandoInvitation) => ({ ok: true as const, invitation: applyDraftPayload(current, dto) });

describe("saveOwnedDraft (una transacción, propiedad y control de concurrencia)", () => {
  it("(70.1) escribe evento, invitación, secciones, sedes, itinerario, regalos, galería y música SOLO dentro de la transacción", async () => {
    const result = await saveOwnedDraft("usr_A", "evt_1", 5, buildFrom(parseFor(andreaFernandoInvitation, 5, { names: ["Ana", "Luis"], story: { paragraphs: ["Nueva historia"] } })));
    expect(result).toMatchObject({ ok: true, revision: 6 });
    expect(log.calls.every((call) => call.client === "tx")).toBe(true);
    for (const expected of ["event.update", "inv.update", "section.updateMany", "loc.updateMany", "tl.updateMany", "gift.updateMany", "gal.updateMany", "music.upsert"]) expect(ops(), expected).toContain(expected);
    expect(log.calls.find((call) => call.op === "event.update")?.args.data).toMatchObject({ title: "Ana & Luis" });
    expect(ops().filter((name) => name === "section.updateMany")).toHaveLength(10);
  });

  it("propiedad en la propia consulta: la invitación se busca por evento Y por propietario", async () => {
    await saveOwnedDraft("usr_A", "evt_1", 5, buildFrom(parseFor()));
    expect(where("inv.findFirst")).toEqual({ eventId: "evt_1", event: { ownerId: "usr_A" } });
    log.row = null;
    expect(await saveOwnedDraft("usr_B", "evt_1", 5, buildFrom(parseFor()))).toEqual({ ok: false, code: "not_found" });
  });

  it("(8) con otra revisión NO escribe nada y devuelve conflicto con la revisión actual", async () => {
    log.row = baseRow({ draftRevision: 9 });
    expect(await saveOwnedDraft("usr_A", "evt_1", 5, buildFrom(parseFor()))).toEqual({ ok: false, code: "conflict", revision: 9 });
    expect(ops()).toEqual(["inv.findFirst"]);
  });

  it("(8) compare-and-set: dos guardados simultáneos → el que pierde recibe conflicto y no escribe", async () => {
    log.casCount = 0;
    expect(await saveOwnedDraft("usr_A", "evt_1", 5, buildFrom(parseFor()))).toMatchObject({ ok: false, code: "conflict" });
    expect(where("inv.updateMany")).toEqual({ id: expect.any(String), draftRevision: 5 });
    expect(ops()).not.toContain("event.update");
  });

  it("(13) el orden de las secciones se escribe como posiciones 0..n-1, sin duplicados, y dentro de su invitación", async () => {
    const reversed = [...andreaFernandoInvitation.sections].reverse();
    await saveOwnedDraft("usr_A", "evt_1", 5, buildFrom(parseFor(andreaFernandoInvitation, 5, { sections: reversed.map((s) => ({ id: s.id, isVisible: s.id !== "sec_gallery" })) })));
    const writes = log.calls.filter((call) => call.op === "section.updateMany");
    expect(writes.map((call) => (call.args.data as { position: number }).position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(writes.every((call) => typeof (call.args.where as { invitationId: string }).invitationId === "string")).toBe(true);
    expect(writes.find((call) => (call.args.where as { id: string }).id === "sec_gallery")?.args.data).toMatchObject({ isVisible: false });
  });

  it("(15/16/18) crea filas nuevas, elimina las que faltan y devuelve los archivos de las sedes eliminadas", async () => {
    log.row = baseRow({ event: { ...baseRow().event, locations: baseRow().event.locations.map((l, i) => (i === 0 ? { ...l, mediaAssetId: "ast_loc" } : l)) } });
    const dto = parseFor(andreaFernandoInvitation, 5, {
      locations: [{ id: "loc_reception", kind: "reception", name: "Recepción", addressLines: ["x"] }, { id: "loc_nueva", kind: "other", name: "Nueva", addressLines: ["y"] }],
      timeline: [{ id: "tl_nuevo", time: "10:00", label: "Nuevo", icon: "other" }],
      giftRegistry: { message: "", entries: [] },
    });
    const result = await saveOwnedDraft("usr_A", "evt_1", 5, buildFrom(dto));
    expect(result).toMatchObject({ ok: true, releasedMediaIds: ["ast_loc"] });
    expect(ops()).toEqual(expect.arrayContaining(["loc.create", "loc.deleteMany", "tl.create", "tl.deleteMany", "gift.deleteMany"]));
    expect(log.calls.find((call) => call.op === "loc.create")?.args.data).toMatchObject({ id: "loc_nueva", eventId: "evt_1", imagePath: null, mediaAssetId: null });
    expect(where("loc.deleteMany")).toEqual({ id: { in: ["loc_ceremony"] }, eventId: "evt_1" });
  });

  it("(17) la galería nunca crea ni borra filas por esta vía", async () => {
    await saveOwnedDraft("usr_A", "evt_1", 5, buildFrom(parseFor()));
    expect(ops().filter((name) => name.startsWith("gal."))).toEqual(Array(4).fill("gal.updateMany"));
    expect(log.calls.filter((call) => call.op === "gal.updateMany").every((call) => (call.args.where as { eventId: string }).eventId === "evt_1")).toBe(true);
  });

  it("el estado de publicación NO se toca al guardar: solo sube la revisión del borrador", async () => {
    await saveOwnedDraft("usr_A", "evt_1", 5, buildFrom(parseFor()));
    const data = JSON.stringify(log.calls.filter((call) => call.op === "inv.update" || call.op === "inv.updateMany").map((call) => call.args.data));
    expect(data).toContain("draftRevision");
    for (const forbidden of ["status", "publishedVersion", "publishedRevision", "publishedAt"]) expect(data, forbidden).not.toContain(forbidden);
  });

  it("un cambio de plantilla exige una publicada, aprobada y del tipo del evento (comprobado dentro de la transacción)", async () => {
    log.template = null;
    const dto = parseFor(andreaFernandoInvitation, 5, { templateSlug: "ivory" });
    expect(await saveOwnedDraft("usr_A", "evt_1", 5, buildFrom(dto))).toEqual({ ok: false, code: "template_unavailable" });
    expect(where("tpl.findFirst")).toMatchObject({ slug: "ivory", publicationStatus: "PUBLISHED", designStatus: "IMPLEMENTED", eventType: "WEDDING" });
    expect(ops()).not.toContain("event.update");
  });

  it("un id de fila nuevo que choca con otro evento se rechaza sin detalles", async () => {
    log.failOn = "loc.create";
    const dto = parseFor(andreaFernandoInvitation, 5, { locations: [{ id: "loc_de_otro", kind: "other", name: "x", addressLines: [""] }] });
    expect(await saveOwnedDraft("usr_A", "evt_1", 5, buildFrom(dto))).toMatchObject({ ok: false, code: "invalid" });
  });

  it("sin base de datos se rechaza (nunca finge guardar)", async () => {
    vi.unstubAllEnvs();
    await expect(saveOwnedDraft("usr_A", "evt_1", 5, buildFrom(parseFor()))).rejects.toThrow(/DATABASE_URL/);
  });
});

describe("publishOwnedInvitation (una transacción)", () => {
  const okBuild = (mediaAssetIds: string[] = []) => ({ invitation, version, publishedAt }: { invitation: typeof andreaFernandoInvitation; version: number; publishedAt: Date }) => ({
    ok: true as const,
    ...{ snapshot: buildPublishedInvitationSnapshot({ invitation, template: magnoliaTemplate, assets: new Map(), version, publishedAt }).snapshot, mediaAssetIds },
  });

  it("(34) primera publicación: snapshot + estado + versión 1 en la misma transacción; el borrador queda como está", async () => {
    const result = await publishOwnedInvitation("usr_A", "evt_1", 5, okBuild(["ast_1"]));
    expect(result).toMatchObject({ ok: true, version: 1, alreadyPublished: false, slug: "andrea-y-fernando", mediaAssetIds: ["ast_1"] });
    expect(log.calls.every((call) => call.client === "tx")).toBe(true);
    expect(where("inv.findFirst")).toEqual({ eventId: "evt_1", event: { ownerId: "usr_A" } });
    expect(log.calls.find((call) => call.op === "pub.create")?.args.data).toMatchObject({ version: 1, isCurrent: true, templateSlug: "magnolia", mediaAssetIds: ["ast_1"] });
    expect(log.calls.find((call) => call.op === "pub.updateMany")?.args).toMatchObject({ where: { isCurrent: true }, data: { isCurrent: false } });
    const update = log.calls.find((call) => call.op === "inv.update")?.args.data as Record<string, unknown>;
    expect(update).toMatchObject({ status: "PUBLISHED", publishedRevision: 5 });
    expect(update).toHaveProperty("publishedAt"); // solo la primera vez
    expect(log.calls.find((call) => call.op === "event.update")?.args.data).toEqual({ status: "ACTIVE" });
    // Publicar no cambia el slug.
    expect(JSON.stringify(update)).not.toContain("slug");
  });

  it("(8/46) republicar incrementa la versión, conserva publishedAt y devuelve los archivos que ya no se usan", async () => {
    log.row = baseRow({ status: "PUBLISHED", publishedVersion: 1, publishedRevision: 3, draftRevision: 6, publishedAt: NOW });
    log.previous = { mediaAssetIds: ["ast_old", "ast_keep"] };
    const result = await publishOwnedInvitation("usr_A", "evt_1", 6, okBuild(["ast_keep"]));
    expect(result).toMatchObject({ ok: true, version: 2, alreadyPublished: false, previousMediaIds: ["ast_old"] });
    expect(log.calls.find((call) => call.op === "pub.create")?.args.data).toMatchObject({ version: 2 });
    expect(log.calls.find((call) => call.op === "inv.update")?.args.data).not.toHaveProperty("publishedAt");
  });

  it("(56) doble publicación: si lo publicado ya es este borrador, NO se crea otra versión", async () => {
    log.row = baseRow({ status: "PUBLISHED", publishedVersion: 2, publishedRevision: 5, draftRevision: 5, publishedAt: NOW });
    expect(await publishOwnedInvitation("usr_A", "evt_1", 5, okBuild())).toMatchObject({ ok: true, version: 2, alreadyPublished: true });
    expect(ops()).not.toContain("pub.create");
  });

  it("(56) publicaciones simultáneas: el compare-and-set de la versión deja pasar solo una", async () => {
    log.casCount = 0;
    expect(await publishOwnedInvitation("usr_A", "evt_1", 5, okBuild())).toMatchObject({ ok: true, alreadyPublished: true });
    expect(where("inv.updateMany")).toMatchObject({ publishedVersion: 0 });
    expect(ops()).not.toContain("pub.create");
  });

  it("(57) datos críticos inválidos abortan sin escribir ninguna publicación ni cambiar el estado", async () => {
    const result = await publishOwnedInvitation("usr_A", "evt_1", 5, () => ({ ok: false, message: "Escribe al menos un nombre en la portada." }));
    expect(result).toEqual({ ok: false, code: "invalid", message: "Escribe al menos un nombre en la portada." });
    expect(ops()).not.toContain("pub.create");
    expect(ops()).not.toContain("event.update");
    expect(log.calls.find((call) => call.op === "inv.update")).toBeUndefined();
  });

  it("(51) un evento ajeno no se publica; una revisión vieja del cliente da conflicto", async () => {
    log.row = null;
    expect(await publishOwnedInvitation("usr_B", "evt_1", 5, okBuild())).toEqual({ ok: false, code: "not_found" });
    log.row = baseRow({ draftRevision: 8 });
    expect(await publishOwnedInvitation("usr_A", "evt_1", 5, okBuild())).toEqual({ ok: false, code: "conflict", revision: 8 });
    expect(ops()).not.toContain("pub.create");
  });

  it("(D-33) republicar una invitación EXISTENTE no exige que su plantilla siga visible: ocultarla en la consola no impide publicar sus cambios", async () => {
    log.row = baseRow({ status: "PUBLISHED", publishedVersion: 1, publishedRevision: 3, draftRevision: 6, publishedAt: NOW });
    await publishOwnedInvitation("usr_A", "evt_1", 6, okBuild());
    const query = where("tpl.findFirst");
    expect(query).not.toHaveProperty("publicationStatus");
    expect(query).toMatchObject({ designStatus: "IMPLEMENTED", eventType: "WEDDING" });
  });

  it("solo se publican archivos READY del propietario y del evento (la consulta lo exige)", async () => {
    log.row = baseRow({ coverMediaId: "ast_1", coverMedia: { id: "ast_1", storageKey: "k", status: "READY", width: 1, height: 1 } });
    await publishOwnedInvitation("usr_A", "evt_1", 5, okBuild());
    expect(where("asset.findMany")).toMatchObject({ ownerId: "usr_A", eventId: "evt_1", status: "READY", id: { in: ["ast_1"] } });
  });
});

describe("(42) La página pública lee el SNAPSHOT, no el borrador", () => {
  const snapshot = () => {
    const changed = { ...andreaFernandoInvitation, story: { paragraphs: ["Historia PUBLICADA"] }, rsvp: { ...andreaFernandoInvitation.rsvp, maxCompanions: 1, message: "RSVP publicado" } };
    return buildPublishedInvitationSnapshot({ invitation: changed, template: magnoliaTemplate, assets: new Map(), version: 3, publishedAt: NOW }).snapshot;
  };

  it("(71.5) devuelve el contenido y el tema PUBLICADOS sin consultar las tablas del borrador", async () => {
    log.head = { id: "inv_1", eventId: "evt_1", publications: [{ snapshot: snapshot() }] };
    log.row = baseRow({ story: "no debe leerse" });
    const record = (await loadPublishedInvitation("andrea-y-fernando")) as PublishedRecord | undefined;
    expect(record?.invitation.story.paragraphs).toEqual(["Historia PUBLICADA"]);
    expect(record?.template?.slug).toBe("magnolia");
    expect(log.calls.filter((call) => call.args.include)).toHaveLength(0); // nunca cargó el borrador
    expect(where("root.inv.findFirst")).toEqual({ slug: "andrea-y-fernando", status: "PUBLISHED" });
  });

  it("(D-33) ocultar la plantilla del catálogo NO rompe una invitación publicada: la lectura pública no consulta la tabla de plantillas", async () => {
    log.head = { id: "inv_1", eventId: "evt_1", publications: [{ snapshot: snapshot() }] };
    const record = (await loadPublishedInvitation("andrea-y-fernando")) as PublishedRecord | undefined;
    expect(record?.invitation.story.paragraphs).toEqual(["Historia PUBLICADA"]);
    expect(record?.template?.slug).toBe("magnolia");
    expect(log.calls.some((call) => /tpl|template/i.test(call.op))).toBe(false);
    expect(JSON.stringify(log.calls.map((call) => call.args))).not.toMatch(/publicationStatus|minimumPlan/);
  });

  it("(30) sin publicación vigente y sin estado PUBLISHED, la URL no existe (404)", async () => {
    log.head = null;
    expect(await loadPublishedInvitation("borrador")).toBeUndefined();
  });

  it("(61) una invitación PUBLISHED sin snapshot (anterior a D-29) sigue funcionando desde el borrador", async () => {
    log.head = { id: "inv_1", eventId: "evt_1", publications: [] };
    const record = (await loadPublishedInvitation("andrea-y-fernando")) as PublishedRecord | undefined;
    expect(record?.invitation.names).toEqual(["Andrea", "Fernando"]);
    expect(record?.template).toBeUndefined();
    expect(log.calls.filter((call) => call.args.include)).toHaveLength(1);
  });

  it("un snapshot corrupto no rompe la página: cae al borrador", async () => {
    log.head = { id: "inv_1", eventId: "evt_1", publications: [{ snapshot: { basura: true } }] };
    expect(((await loadPublishedInvitation("andrea-y-fernando")) as PublishedRecord | undefined)?.invitation.names).toEqual(["Andrea", "Fernando"]);
  });

  it("(43/73) el invitado y su RSVP salen de la BD VIVA; la configuración del RSVP, del snapshot publicado", async () => {
    log.head = { id: "inv_1", eventId: "evt_1", publications: [{ snapshot: snapshot() }] };
    const token = "a".repeat(32);
    const record = await getPublicInvitationRecord("andrea-y-fernando", token);
    expect(record).toMatchObject({ tokenStatus: "valid", eventId: "evt_1", guest: { name: "Mariana", maxCompanions: 2, current: { status: "ATTENDING", attendeeCount: 2, message: "hola" } } });
    const guestQuery = log.calls.find((call) => call.op === "root.guest.findFirst");
    expect(guestQuery?.args.where).toEqual({ inviteToken: token, eventId: "evt_1" });
    const target = (await resolveRsvpTarget("andrea-y-fernando", token)) as Exclude<Awaited<ReturnType<typeof resolveRsvpTarget>>, "expired" | null>;
    expect(target?.rsvp).toMatchObject({ maxCompanions: 1, message: "RSVP publicado" }); // configuración publicada, no la del borrador
    expect(target?.guestId).toBe("g1"); // guardar la respuesta sigue siendo por invitado vivo
  });

  it("el contexto público no expone ids de archivos ni de invitados aunque el snapshot los tenga", async () => {
    const withAsset = buildPublishedInvitationSnapshot({
      invitation: { ...andreaFernandoInvitation, cover: { ...andreaFernandoInvitation.cover, photo: { src: "x", alt: "c", mediaAssetId: "ast_1" } } },
      template: magnoliaTemplate,
      assets: new Map([["ast_1", { storageKey: "users/u/events/e/k.png" }]]),
      version: 1,
      publishedAt: NOW,
    }).snapshot;
    log.head = { id: "inv_1", eventId: "evt_1", publications: [{ snapshot: withAsset }] };
    const record = (await loadPublishedInvitation("andrea-y-fernando")) as PublishedRecord | undefined;
    const json = JSON.stringify(record);
    expect(json).not.toContain("ast_1");
    expect(json).not.toContain("mediaAssetId");
  });
});
