import { describe, expect, it } from "vitest";
import { invitationToDraftPayload, parseDraftPayload, applyDraftPayload } from "@/lib/editor/draft-payload";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { magnoliaTemplate } from "@/lib/invitation/templates/magnolia";
import { buildPublishedInvitationSnapshot, snapshotToInvitation } from "@/lib/publishing/snapshot";
import { dbInvitationToDomain, domainInvitationToDb, type InvitationAggregateRow, type MediaRefRow } from "@/server/mappers/invitation";
import { getDemoRows } from "@/server/repositories/demo-store";
import { attachDressCodeImage, createImageUpload, deleteMediaAsset, finalizeImageUpload, removeDressCodeImage } from "@/server/services/media-service";
import { buildMediaUrl } from "@/server/storage/public-url";
import type { Invitation } from "@/types/invitation";
import { jpegBytes, makeWorld, pngBytes, PUBLIC_BASE } from "../helpers/media-world";

/**
 * Ilustración del código de vestimenta: antes era solo vista previa local (se perdía al recargar y nunca se publicaba). Ahora se
 * gestiona como la portada: se sube, se verifica, se guarda como referencia (`Invitation.dressCodeMediaId`) y se publica.
 */
type World = ReturnType<typeof makeWorld>;

async function uploadReady(world: World, eventId = "evt_A", bytes: Uint8Array = pngBytes(1000, 1250), mimeType = "image/png") {
  const requested = await createImageUpload(eventId, { filename: "vestimenta.png", mimeType, sizeBytes: bytes.byteLength }, world.deps);
  if (!requested.result.ok) throw new Error(`permiso: ${requested.result.message}`);
  const { mediaAssetId } = requested.result.upload;
  world.storage.put(world.repo.assets.get(mediaAssetId)!.storageKey, bytes);
  const finalized = await finalizeImageUpload(eventId, mediaAssetId, world.deps);
  if (!finalized.result.ok) throw new Error(`verificación: ${finalized.result.message}`);
  return mediaAssetId;
}

describe("Ilustración del código de vestimenta: servicio", () => {
  it("se sube, se guarda como referencia del evento y devuelve la URL derivada de la clave", async () => {
    const world = makeWorld();
    const id = await uploadReady(world);
    const { result, revalidate } = await attachDressCodeImage("evt_A", id, "  Traje formal  ", world.deps);
    expect(result).toMatchObject({ ok: true, image: { mediaAssetId: id, alt: "Traje formal", width: 1000, height: 1250 } });
    expect(result.ok && result.image.src).toBe(`${PUBLIC_BASE}/${world.repo.assets.get(id)!.storageKey}`);
    expect(world.repo.dressCode.get("evt_A")).toEqual({ assetId: id, alt: "Traje formal" });
    expect(world.repo.cover.get("evt_A")).toBeUndefined(); // la portada no se toca
    expect(revalidate).toEqual({ eventId: "evt_A", slug: "boda-a" });
  });

  it("reemplazarla retira la anterior; quitarla borra el archivo", async () => {
    const world = makeWorld();
    const first = await uploadReady(world);
    await attachDressCodeImage("evt_A", first, "", world.deps);
    const second = await uploadReady(world, "evt_A", jpegBytes(800, 1000), "image/jpeg");
    await attachDressCodeImage("evt_A", second, "", world.deps);
    expect(world.repo.assets.get(first)?.status).toBe("DELETED");
    expect(world.repo.dressCode.get("evt_A")?.assetId).toBe(second);

    expect((await removeDressCodeImage("evt_A", world.deps)).result).toMatchObject({ ok: true });
    expect(world.repo.dressCode.get("evt_A")).toEqual({ assetId: null, alt: "" });
    expect(world.repo.assets.get(second)?.status).toBe("DELETED");
  });

  it("en uso no se puede borrar directamente", async () => {
    const world = makeWorld();
    const id = await uploadReady(world);
    await attachDressCodeImage("evt_A", id, "", world.deps);
    expect((await deleteMediaAsset("evt_A", id, world.deps)).result).toMatchObject({ ok: false, code: "in_use" });
  });

  it("A no puede poner ni quitar la ilustración del evento de B, ni usar un archivo de B", async () => {
    const worldB = makeWorld("usr_B");
    const bAsset = await uploadReady(worldB, "evt_B");
    await attachDressCodeImage("evt_B", bAsset, "", worldB.deps);

    const world = makeWorld("usr_A");
    Object.assign(world.repo, { assets: worldB.repo.assets, events: worldB.repo.events, dressCode: worldB.repo.dressCode });
    expect((await removeDressCodeImage("evt_B", world.deps)).result).toMatchObject({ ok: false, code: "not_found" });
    expect((await attachDressCodeImage("evt_A", bAsset, "", world.deps)).result).toMatchObject({ ok: false, code: "not_found" });
    expect(worldB.repo.dressCode.get("evt_B")?.assetId).toBe(bAsset);
    expect(worldB.repo.assets.get(bAsset)?.status).toBe("READY");
  });
});

const NOW = new Date("2026-10-28T12:00:00Z");
const BASE = "https://media.test";
const options = { mediaUrl: (key: string) => buildMediaUrl(BASE, key) };
const ownerOptions = { ...options, exposeMediaIds: true };
const media = (id: string, over: Partial<MediaRefRow> = {}): MediaRefRow => ({ id, storageKey: `users/u/events/e/${id.padEnd(32, "0")}.webp`, status: "READY", width: 1000, height: 1250, ...over });
const withDressCodeMedia = (over: Partial<InvitationAggregateRow> = {}): InvitationAggregateRow => ({ ...getDemoRows(NOW).invitation, dressCodeAlt: "Traje formal", dressCodeMedia: media("dress1"), ...over });

describe("Ilustración del código de vestimenta: mapeo, guardado y publicación", () => {
  it("la ilustración propia sustituye a la del contenido; la pública no lleva ids y el editor sí", () => {
    const publicView = dbInvitationToDomain(withDressCodeMedia(), options);
    expect(publicView.dressCode?.illustration).toEqual({ src: `${BASE}/${media("dress1").storageKey}`, alt: "Traje formal", width: 1000, height: 1250 });
    expect(publicView.dressCode?.style).toBe(andreaFernandoInvitation.dressCode?.style); // el texto sigue saliendo del contenido
    expect(dbInvitationToDomain(withDressCodeMedia(), ownerOptions).dressCode?.illustration?.mediaAssetId).toBe("dress1");
  });

  it("sin ilustración propia (o sin terminar de subir) queda la del contenido, como antes", () => {
    const original = dbInvitationToDomain(getDemoRows(NOW).invitation, options).dressCode;
    expect(dbInvitationToDomain(withDressCodeMedia({ dressCodeMedia: null }), options).dressCode).toEqual(original);
    expect(dbInvitationToDomain(withDressCodeMedia({ dressCodeMedia: media("dress1", { status: "PENDING" }) }), options).dressCode).toEqual(original);
  });

  it("la ilustración gestionada NO se copia al JSON de la sección (vive en Invitation.dressCodeMediaId)", () => {
    const write = domainInvitationToDb(dbInvitationToDomain(withDressCodeMedia(), ownerOptions));
    const content = JSON.stringify(write.sections.find((section) => section.type === "DRESS_CODE")?.content);
    expect(content).not.toContain("mediaAssetId");
    expect(content).not.toContain(BASE);
    expect(content).toContain(andreaFernandoInvitation.dressCode!.style);
  });

  it("el autoguardado lleva el texto alternativo de la ilustración gestionada, nunca la imagen", () => {
    const current = dbInvitationToDomain(withDressCodeMedia(), ownerOptions);
    const edited: Invitation = { ...current, dressCode: { ...current.dressCode!, illustration: { ...current.dressCode!.illustration!, alt: "Vestido largo" } } };
    const parsed = parseDraftPayload(invitationToDraftPayload(edited, 3));
    if (!parsed.ok) throw new Error(parsed.message);
    expect(parsed.value.dressCode?.illustrationAlt).toBe("Vestido largo");
    const next = applyDraftPayload(current, parsed.value);
    expect(next.dressCode?.illustration).toMatchObject({ mediaAssetId: "dress1", alt: "Vestido largo" });

    // Una imagen LOCAL (vista previa del navegador) no viaja: el servidor conserva la que tenía.
    const local: Invitation = { ...andreaFernandoInvitation, dressCode: { ...andreaFernandoInvitation.dressCode!, illustration: { src: "blob:http://x/1", alt: "local" } } };
    const localParsed = parseDraftPayload(invitationToDraftPayload(local, 3));
    if (!localParsed.ok) throw new Error(localParsed.message);
    expect(JSON.stringify(localParsed.value)).not.toContain("blob:");
    expect(applyDraftPayload(andreaFernandoInvitation, localParsed.value).dressCode?.illustration).toEqual(andreaFernandoInvitation.dressCode?.illustration);
  });

  it("publicar incluye la ilustración propia y la protege de ser borrada mientras esté publicada", () => {
    const invitation = dbInvitationToDomain(withDressCodeMedia(), ownerOptions);
    const { snapshot, mediaAssetIds } = buildPublishedInvitationSnapshot({ invitation, template: magnoliaTemplate, assets: new Map([["dress1", { storageKey: media("dress1").storageKey, width: 1000, height: 1250 }]]), version: 1, publishedAt: NOW });
    expect(mediaAssetIds).toContain("dress1");
    expect(snapshotToInvitation(snapshot, (key) => `${BASE}/${key}`).dressCode?.illustration).toMatchObject({ src: `${BASE}/${media("dress1").storageKey}`, alt: "Traje formal" });
  });
});
