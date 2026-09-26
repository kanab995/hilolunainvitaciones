import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Con base de datos, TODA operación de archivos lleva propietario y evento en la propia consulta (también las
 * escrituras). Prisma se sustituye por un doble que captura los `where`: si alguien quita `ownerId` o
 * `event.ownerId` de una consulta, estas pruebas fallan.
 */
const log = vi.hoisted(() => ({ calls: [] as { op: string; args: Record<string, unknown> }[] }));
const rec = (op: string, result: unknown = null) =>
  vi.fn(async (args: Record<string, unknown>) => {
    log.calls.push({ op, args });
    return typeof result === "function" ? (result as () => unknown)() : result;
  });

const tx = vi.hoisted(() => ({
  mediaAsset: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
  invitation: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  invitationPublication: { count: vi.fn() },
  event: { findFirst: vi.fn() },
  galleryImage: { aggregate: vi.fn(), create: vi.fn(), findFirst: vi.fn(), delete: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  location: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
}));

vi.mock("@/server/db/client", () => ({ prisma: { ...tx, $transaction: vi.fn(async (cb: (client: typeof tx) => unknown) => cb(tx)) } }));

import { prismaMediaRepository as repo } from "@/server/repositories/media";

const where = (op: string) => log.calls.find((call) => call.op === op)?.args.where as Record<string, unknown>;

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://prueba");
  log.calls.length = 0;
  tx.mediaAsset.create.mockImplementation(rec("asset.create", { id: "ast_1" }));
  tx.mediaAsset.findFirst.mockImplementation(rec("asset.findFirst", null));
  tx.mediaAsset.updateMany.mockImplementation(rec("asset.updateMany", { count: 1 }));
  tx.mediaAsset.findUnique.mockImplementation(rec("asset.findUnique", null));
  tx.invitation.findFirst.mockImplementation(rec("inv.findFirst", { id: "inv_1", coverMediaId: "old", slug: "s" }));
  tx.invitation.update.mockImplementation(rec("inv.update", { draftRevision: 2 }));
  tx.invitationPublication.count.mockImplementation(rec("pub.count", 0));
  tx.invitation.updateMany.mockImplementation(rec("inv.updateMany", { count: 1 }));
  tx.invitation.count.mockImplementation(rec("inv.count", 0));
  tx.event.findFirst.mockImplementation(rec("event.findFirst", { id: "evt_A" }));
  tx.galleryImage.aggregate.mockImplementation(rec("gal.aggregate", { _max: { position: 2 } }));
  tx.galleryImage.create.mockImplementation(rec("gal.create", { id: "gal_1" }));
  tx.galleryImage.findFirst.mockImplementation(rec("gal.findFirst", { id: "gal_1", mediaAssetId: "ast_9" }));
  tx.galleryImage.delete.mockImplementation(rec("gal.delete", {}));
  tx.galleryImage.updateMany.mockImplementation(rec("gal.updateMany", { count: 1 }));
  tx.galleryImage.count.mockImplementation(rec("gal.count", 0));
  tx.location.findFirst.mockImplementation(rec("loc.findFirst", { id: "loc_1", mediaAssetId: null }));
  tx.location.update.mockImplementation(rec("loc.update", {}));
  tx.location.updateMany.mockImplementation(rec("loc.updateMany", { count: 1 }));
  tx.location.count.mockImplementation(rec("loc.count", 0));
});
afterEach(() => vi.unstubAllEnvs());

describe("Repositorio de archivos: alcance por propietario y evento", () => {
  it("buscar un archivo exige id + propietario + evento + evento del propietario", async () => {
    await repo.findOwned("usr_A", "evt_A", "ast_1");
    expect(where("asset.findFirst")).toEqual({ id: "ast_1", ownerId: "usr_A", eventId: "evt_A", event: { ownerId: "usr_A" } });
  });

  it("crear un archivo pendiente escribe el propietario que pasó el servicio (nunca del cliente) y nace PENDING", async () => {
    await repo.createPending({ ownerId: "usr_A", eventId: "evt_A", storageKey: "users/usr_A/events/evt_A/k.png", mimeType: "image/png", originalFilename: "x.png", sizeBytes: 10 });
    expect(log.calls[0]?.args.data).toMatchObject({ ownerId: "usr_A", eventId: "evt_A", status: "PENDING", type: "IMAGE" });
  });

  it("verificar solo actúa desde PENDING (idempotente; un DELETED no resucita)", async () => {
    await repo.markReady("ast_1", { mimeType: "image/png", sizeBytes: 10, width: 5, height: 5 });
    expect(where("asset.updateMany")).toEqual({ id: "ast_1", status: "PENDING" });
  });

  it("portada: la invitación se busca por evento del propietario", async () => {
    expect(await repo.setCover("usr_A", "evt_A", "ast_1", "alt")).toMatchObject({ previousAssetId: "old" });
    expect(where("inv.findFirst")).toEqual({ eventId: "evt_A", event: { ownerId: "usr_A" } });
    expect(log.calls.find((call) => call.op === "inv.update")?.args.data).toMatchObject({ coverMediaId: "ast_1", coverAlt: "alt", draftRevision: { increment: 1 } });
    tx.invitation.findFirst.mockImplementation(rec("inv.findFirst", null));
    expect(await repo.setCover("usr_B", "evt_A", null, "")).toBeUndefined();
  });

  it("galería: añadir, quitar y ajustar exigen el evento del propietario", async () => {
    await repo.addGalleryImage("usr_A", "evt_A", "ast_1", "");
    expect(where("event.findFirst")).toEqual({ id: "evt_A", ownerId: "usr_A" });
    expect(log.calls.find((call) => call.op === "gal.create")?.args.data).toMatchObject({ eventId: "evt_A", mediaAssetId: "ast_1", src: null, position: 3 });

    log.calls.length = 0;
    expect(await repo.removeGalleryImage("usr_A", "evt_A", "gal_1")).toMatchObject({ assetId: "ast_9" });
    expect(where("gal.findFirst")).toEqual({ id: "gal_1", eventId: "evt_A", event: { ownerId: "usr_A" } });

  });

  it("un evento ajeno: ningún ajuste ni alta se escribe", async () => {
    tx.event.findFirst.mockImplementation(rec("event.findFirst", null));
    expect(await repo.addGalleryImage("usr_B", "evt_A", "ast_1", "")).toBeUndefined();
    expect(log.calls.some((call) => call.op === "gal.create" || call.op === "gal.updateMany")).toBe(false);
  });

  it("sedes: la imagen propia se referencia por id y limpia la ruta estática; quitarla solo suelta la referencia", async () => {
    await repo.setLocationImage("usr_A", "evt_A", "loc_1", "ast_1", "Parroquia");
    expect(where("loc.findFirst")).toEqual({ id: "loc_1", eventId: "evt_A", event: { ownerId: "usr_A" } });
    expect(log.calls.find((call) => call.op === "loc.update")?.args.data).toEqual({ mediaAssetId: "ast_1", imageAlt: "Parroquia", imagePath: null, imageWidth: null, imageHeight: null });
    log.calls.length = 0;
    await repo.setLocationImage("usr_A", "evt_A", "loc_1", null, "");
    expect(log.calls.find((call) => call.op === "loc.update")?.args.data).toEqual({ mediaAssetId: null });
  });

  it("sin base de datos las operaciones se rechazan (no se finge que se guardó)", async () => {
    vi.unstubAllEnvs();
    await expect(repo.findOwned("u", "e", "a")).rejects.toThrow(/DATABASE_URL/);
    await expect(repo.setCover("u", "e", null, "")).rejects.toThrow(/DATABASE_URL/);
  });
});
