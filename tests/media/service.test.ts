import { describe, expect, it } from "vitest";
import { MEDIA_LIMITS, mediaMessages } from "@/lib/media/limits";
import {
  addGalleryImage,
  attachCoverImage,
  attachLocationImage,
  createImageUpload,
  deleteMediaAsset,
  finalizeImageUpload,
  removeCoverImage,
  removeGalleryImage,
} from "@/server/services/media-service";
import { MEDIA_KEY_PATTERN } from "@/server/storage/keys";
import { GIF_BYTES, jpegBytes, makeWorld, pngBytes, PUBLIC_BASE, SVG_BYTES } from "../helpers/media-world";

type World = ReturnType<typeof makeWorld>;

/** Flujo completo de una subida correcta: permiso → PUT (simulado) → verificación. Devuelve el id del archivo. */
async function uploadReady(world: World, eventId = "evt_A", bytes: Uint8Array = pngBytes(1200, 800), mimeType = "image/png") {
  const requested = await createImageUpload(eventId, { filename: "mi foto.png", mimeType, sizeBytes: bytes.byteLength }, world.deps);
  if (!requested.result.ok) throw new Error(`permiso: ${requested.result.message}`);
  const { mediaAssetId } = requested.result.upload;
  world.storage.put(world.repo.assets.get(mediaAssetId)!.storageKey, bytes);
  const finalized = await finalizeImageUpload(eventId, mediaAssetId, world.deps);
  if (!finalized.result.ok) throw new Error(`verificación: ${finalized.result.message}`);
  return mediaAssetId;
}

describe("Seguridad de los archivos (A no puede tocar lo de B)", () => {
  it("1. A no puede crear un archivo en el evento de B", async () => {
    const world = makeWorld("usr_A");
    const { result } = await createImageUpload("evt_B", { filename: "x.png", mimeType: "image/png", sizeBytes: 100 }, world.deps);
    expect(result).toMatchObject({ ok: false, code: "not_found" });
    expect(world.repo.assets.size).toBe(0);
    expect(world.storage.targets).toHaveLength(0);
  });

  it("2. A no puede asociar un archivo de B a su evento (ni siquiera con su id)", async () => {
    const worldB = makeWorld("usr_B");
    const bAsset = await uploadReady(worldB, "evt_B");
    // La misma «base de datos», pero la sesión es A.
    const world = makeWorld("usr_A");
    world.repo.assets = worldB.repo.assets;
    world.repo.events = worldB.repo.events;
    for (const outcome of [
      await attachCoverImage("evt_A", bAsset, "x", world.deps),
      await addGalleryImage("evt_A", bAsset, "x", world.deps),
      await attachLocationImage("evt_A", "loc_A", bAsset, "x", world.deps),
    ]) {
      expect(outcome.result).toMatchObject({ ok: false, code: "not_found" });
    }
    expect(world.repo.cover.get("evt_A")).toBeUndefined();
    expect(world.repo.gallery.filter((g) => g.assetId === bAsset)).toHaveLength(0);
  });

  it("2b. tampoco entre eventos del mismo usuario: el archivo pertenece a UN evento", async () => {
    const world = makeWorld("usr_A");
    world.repo.events.set("evt_A2", "usr_A");
    const asset = await uploadReady(world, "evt_A");
    expect((await attachCoverImage("evt_A2", asset, "x", world.deps)).result).toMatchObject({ ok: false, code: "not_found" });
  });

  it("3. A no puede borrar el archivo de B, ni su fila de galería, ni su portada", async () => {
    const worldB = makeWorld("usr_B");
    const bAsset = await uploadReady(worldB, "evt_B");
    await attachCoverImage("evt_B", bAsset, "portada", worldB.deps);
    const gal = await addGalleryImage("evt_B", await uploadReady(worldB, "evt_B"), "", worldB.deps);
    const galleryId = gal.result.ok ? gal.result.item.id : "";

    const world = makeWorld("usr_A");
    Object.assign(world.repo, { assets: worldB.repo.assets, events: worldB.repo.events, cover: worldB.repo.cover, gallery: worldB.repo.gallery });
    expect((await deleteMediaAsset("evt_B", bAsset, world.deps)).result).toMatchObject({ ok: false, code: "not_found" });
    expect((await deleteMediaAsset("evt_A", bAsset, world.deps)).result).toMatchObject({ ok: false, code: "not_found" });
    expect((await removeGalleryImage("evt_B", galleryId, world.deps)).result).toMatchObject({ ok: false, code: "not_found" });
    expect((await removeCoverImage("evt_B", world.deps)).result).toMatchObject({ ok: false, code: "not_found" });
    expect(world.repo.assets.get(bAsset)?.status).toBe("READY");
    expect(worldB.storage.deleted).toHaveLength(0);
  });

  it("sin sesión no se hace nada", async () => {
    const world = makeWorld(null);
    const { result } = await createImageUpload("evt_A", { filename: "x.png", mimeType: "image/png", sizeBytes: 100 }, world.deps);
    expect(result).toMatchObject({ ok: false, code: "unauthenticated" });
    expect(world.repo.assets.size).toBe(0);
  });

  it("4. un MIME no permitido se rechaza antes de emitir la URL de subida", async () => {
    const world = makeWorld();
    for (const mimeType of ["image/svg+xml", "image/gif", "application/pdf", "text/html", ""]) {
      const { result } = await createImageUpload("evt_A", { filename: "x", mimeType, sizeBytes: 100 }, world.deps);
      expect(result, mimeType).toMatchObject({ ok: false, code: "unsupported", message: mediaMessages.badType });
    }
    expect(world.storage.targets).toHaveLength(0);
    expect(world.repo.assets.size).toBe(0);
  });

  it("4b. un MIME declarado válido pero contenido SVG/GIF/otro tipo se rechaza al verificar y se borra el objeto", async () => {
    const world = makeWorld();
    for (const bytes of [SVG_BYTES, GIF_BYTES]) {
      const requested = await createImageUpload("evt_A", { filename: "x.png", mimeType: "image/png", sizeBytes: bytes.byteLength }, world.deps);
      const id = requested.result.ok ? requested.result.upload.mediaAssetId : "";
      const key = world.repo.assets.get(id)!.storageKey;
      world.storage.put(key, bytes);
      expect((await finalizeImageUpload("evt_A", id, world.deps)).result).toMatchObject({ ok: false, code: "unsupported" });
      expect(world.storage.objects.has(key)).toBe(false);
      expect(world.repo.assets.get(id)?.status).toBe("DELETED");
    }
    // JPEG real declarado como PNG: el tipo firmado no coincide → rechazado.
    const requested = await createImageUpload("evt_A", { filename: "x.png", mimeType: "image/png", sizeBytes: 100 }, world.deps);
    const id = requested.result.ok ? requested.result.upload.mediaAssetId : "";
    world.storage.put(world.repo.assets.get(id)!.storageKey, jpegBytes(100, 100));
    expect((await finalizeImageUpload("evt_A", id, world.deps)).result).toMatchObject({ ok: false, code: "unsupported" });
  });

  it("5. un archivo demasiado grande se rechaza: por el tamaño declarado y por el tamaño REAL del objeto", async () => {
    const world = makeWorld();
    const declared = await createImageUpload("evt_A", { filename: "x.png", mimeType: "image/png", sizeBytes: MEDIA_LIMITS.maxBytes + 1 }, world.deps);
    expect(declared.result).toMatchObject({ ok: false, code: "too_large", message: "La imagen supera el tamaño máximo permitido." });

    // El cliente miente: declara poco y sube mucho. Manda el tamaño que mide el servidor.
    const requested = await createImageUpload("evt_A", { filename: "x.png", mimeType: "image/png", sizeBytes: 1000 }, world.deps);
    const id = requested.result.ok ? requested.result.upload.mediaAssetId : "";
    const key = world.repo.assets.get(id)!.storageKey;
    const big = new Uint8Array(MEDIA_LIMITS.maxBytes + 10);
    big.set(pngBytes(100, 100));
    world.storage.put(key, big);
    expect((await finalizeImageUpload("evt_A", id, world.deps)).result).toMatchObject({ ok: false, code: "too_large" });
    expect(world.storage.objects.has(key)).toBe(false);
  });

  it("6. la clave es opaca, sin datos personales, y el nombre del usuario nunca entra", async () => {
    const world = makeWorld();
    await createImageUpload("evt_A", { filename: "Ana López boda secreta.png", mimeType: "image/png", sizeBytes: 100 }, world.deps);
    const [row] = [...world.repo.assets.values()];
    expect(row!.storageKey).toMatch(MEDIA_KEY_PATTERN);
    expect(row!.storageKey).toMatch(/^users\/usr_A\/events\/evt_A\/[0-9a-f]{32}\.png$/);
    for (const forbidden of ["Ana", "López", "boda", "secreta", "example.com", " "]) expect(row!.storageKey).not.toContain(forbidden);
    expect(row!.originalFilename).toBe("Ana López boda secreta.png"); // solo metadato
  });

  it("7. una URL externa no puede convertirse en archivo gestionado", async () => {
    const world = makeWorld();
    for (const forbidden of ["https://random-site.com/photo.jpg", "http://evil.test/x.png", "../../etc/passwd", "javascript:alert(1)"]) {
      expect((await attachCoverImage("evt_A", forbidden, "x", world.deps)).result).toMatchObject({ ok: false, code: "not_found" });
      expect((await addGalleryImage("evt_A", forbidden, "x", world.deps)).result).toMatchObject({ ok: false, code: "not_found" });
      expect((await attachLocationImage("evt_A", "loc_A", forbidden, "x", world.deps)).result).toMatchObject({ ok: false, code: "not_found" });
    }
    expect(world.repo.cover.size).toBe(0);
    expect(world.repo.gallery.filter((g) => g.assetId)).toHaveLength(0);
  });

  it("un archivo PENDING o eliminado nunca se puede asociar", async () => {
    const world = makeWorld();
    const pending = await createImageUpload("evt_A", { filename: "x.png", mimeType: "image/png", sizeBytes: 100 }, world.deps);
    const id = pending.result.ok ? pending.result.upload.mediaAssetId : "";
    expect((await attachCoverImage("evt_A", id, "x", world.deps)).result).toMatchObject({ ok: false, code: "not_found" });
    const ready = await uploadReady(world);
    await deleteMediaAsset("evt_A", ready, world.deps);
    expect((await attachCoverImage("evt_A", ready, "x", world.deps)).result).toMatchObject({ ok: false, code: "not_found" });
  });

  it("los errores del almacenamiento no filtran bucket, clave ni mensajes del SDK", async () => {
    const world = makeWorld();
    world.storage.createUploadTarget = async () => {
      throw new Error("AccessDenied: bucket secreto-bucket clave AKIASECRETA");
    };
    const { result } = await createImageUpload("evt_A", { filename: "x.png", mimeType: "image/png", sizeBytes: 100 }, world.deps);
    expect(result).toEqual({ ok: false, code: "error", message: mediaMessages.uploadFailed });
    expect(JSON.stringify(result)).not.toMatch(/secreto|AKIA|bucket|AccessDenied/);
    expect([...world.repo.assets.values()].every((asset) => asset.status === "DELETED")).toBe(true); // no queda un PENDING colgado
  });
});

describe("Funcionamiento: portada, galería y sedes", () => {
  it("8. portada: sube, se persiste como referencia y se muestra con URL derivada de la clave", async () => {
    const world = makeWorld();
    const id = await uploadReady(world);
    const { result, revalidate } = await attachCoverImage("evt_A", id, "  Andrea y Fernando  ", world.deps);
    expect(result).toMatchObject({ ok: true, image: { mediaAssetId: id, alt: "Andrea y Fernando", width: 1200, height: 800 } });
    const key = world.repo.assets.get(id)!.storageKey;
    expect(result.ok && result.image.src).toBe(`${PUBLIC_BASE}/${key}`);
    expect(world.repo.cover.get("evt_A")).toEqual({ assetId: id, alt: "Andrea y Fernando" });
    expect(revalidate).toEqual({ eventId: "evt_A", slug: "boda-a" }); // /i/boda-a se revalida
  });

  it("8b. quitar la portada borra el archivo (nada más lo usa) y deja la portada de la plantilla", async () => {
    const world = makeWorld();
    const id = await uploadReady(world);
    await attachCoverImage("evt_A", id, "", world.deps);
    const key = world.repo.assets.get(id)!.storageKey;
    expect((await removeCoverImage("evt_A", world.deps)).result).toMatchObject({ ok: true });
    expect(world.repo.cover.get("evt_A")).toEqual({ assetId: null, alt: "" });
    expect(world.storage.deleted).toEqual([key]);
    expect(world.repo.assets.get(id)?.status).toBe("DELETED");
  });

  it("9. reemplazar la portada crea una clave NUEVA y retira la anterior (claves inmutables)", async () => {
    const world = makeWorld();
    const first = await uploadReady(world);
    await attachCoverImage("evt_A", first, "uno", world.deps);
    const second = await uploadReady(world, "evt_A", jpegBytes(900, 600), "image/jpeg");
    await attachCoverImage("evt_A", second, "dos", world.deps);
    expect(world.repo.assets.get(first)!.storageKey).not.toBe(world.repo.assets.get(second)!.storageKey);
    expect(world.repo.cover.get("evt_A")?.assetId).toBe(second);
    expect(world.storage.deleted).toEqual([world.repo.assets.get(first)!.storageKey]);
    expect([...world.repo.assets.values()].filter((asset) => asset.status === "READY")).toHaveLength(1);
  });

  it("10. galería: agregar, eliminar y reordenar sin duplicar archivos", async () => {
    const world = makeWorld();
    const a = await uploadReady(world);
    const b = await uploadReady(world, "evt_A", jpegBytes(600, 900), "image/jpeg");
    const addedA = await addGalleryImage("evt_A", a, "Foto A", world.deps);
    const addedB = await addGalleryImage("evt_A", b, "", world.deps);
    const idA = addedA.result.ok ? addedA.result.item.id : "";
    const idB = addedB.result.ok ? addedB.result.item.id : "";
    expect(addedA.result).toMatchObject({ ok: true, item: { alt: "Foto A", mediaAssetId: a } });

    // El mismo archivo no puede ser dos imágenes de la galería.
    expect((await addGalleryImage("evt_A", a, "otra vez", world.deps)).result).toMatchObject({ ok: false, code: "in_use" });
    expect(world.repo.gallery.filter((g) => g.assetId === a)).toHaveLength(1);

    // Eliminar borra la fila y el archivo; la estática solo la fila (no es un MediaAsset).
    expect((await removeGalleryImage("evt_A", idA, world.deps)).result).toMatchObject({ ok: true });
    expect(world.storage.deleted).toEqual([world.repo.assets.get(a)!.storageKey]);
    expect((await removeGalleryImage("evt_A", "gal_static_A", world.deps)).result).toMatchObject({ ok: true });
    expect(world.storage.deleted).toHaveLength(1); // nada que borrar del bucket: era un asset de la plantilla
    expect(world.repo.gallery.map((g) => g.id).filter((id) => id !== "gal_static_A")).toEqual([idB]);
  });

  it("11. una sede acepta un MediaAsset propio; quitarlo no toca la sede", async () => {
    const world = makeWorld();
    const id = await uploadReady(world);
    const { result } = await attachLocationImage("evt_A", "loc_A", id, "Parroquia", world.deps);
    expect(result).toMatchObject({ ok: true, image: { mediaAssetId: id, alt: "Parroquia" } });
    expect(world.repo.locations.find((l) => l.id === "loc_A")).toMatchObject({ assetId: id, alt: "Parroquia" });
    // Una sede de otro evento no se puede tocar.
    const other = await uploadReady(world);
    expect((await attachLocationImage("evt_A", "loc_B", other, "x", world.deps)).result).toMatchObject({ ok: false, code: "not_found" });
  });

  it("reintentar la verificación no crea un segundo archivo READY (idempotente)", async () => {
    const world = makeWorld();
    const id = await uploadReady(world);
    const again = await finalizeImageUpload("evt_A", id, world.deps);
    expect(again.result).toMatchObject({ ok: true, image: { mediaAssetId: id } });
    expect([...world.repo.assets.values()].filter((asset) => asset.status === "READY")).toHaveLength(1);
  });

  it("si la subida no llegó al bucket, se puede reintentar la verificación sin perder el permiso", async () => {
    const world = makeWorld();
    const requested = await createImageUpload("evt_A", { filename: "x.png", mimeType: "image/png", sizeBytes: 100 }, world.deps);
    const id = requested.result.ok ? requested.result.upload.mediaAssetId : "";
    expect((await finalizeImageUpload("evt_A", id, world.deps)).result).toMatchObject({ ok: false, message: mediaMessages.interrupted });
    expect(world.repo.assets.get(id)?.status).toBe("PENDING");
    world.storage.put(world.repo.assets.get(id)!.storageKey, pngBytes(100, 100));
    expect((await finalizeImageUpload("evt_A", id, world.deps)).result).toMatchObject({ ok: true });
  });

  it("un archivo en uso no se puede eliminar directamente; uno sin uso, sí", async () => {
    const world = makeWorld();
    const used = await uploadReady(world);
    await attachCoverImage("evt_A", used, "", world.deps);
    expect((await deleteMediaAsset("evt_A", used, world.deps)).result).toMatchObject({ ok: false, code: "in_use" });
    expect(world.storage.deleted).toHaveLength(0);
    const loose = await uploadReady(world);
    expect((await deleteMediaAsset("evt_A", loose, world.deps)).result).toEqual({ ok: true });
    expect(world.storage.deleted).toEqual([world.repo.assets.get(loose)!.storageKey]);
  });

  it("si el bucket falla al borrar, la operación del usuario no falla y el archivo queda READY sin referencias (huérfano documentado)", async () => {
    const world = makeWorld();
    const id = await uploadReady(world);
    await attachCoverImage("evt_A", id, "", world.deps);
    world.storage.failDelete = true;
    expect((await removeCoverImage("evt_A", world.deps)).result).toMatchObject({ ok: true });
    expect(world.repo.assets.get(id)?.status).toBe("READY");
    expect(await world.repo.countReferences(id)).toBe(0);
  });

  it("sin almacenamiento configurado las subidas se rechazan con un mensaje claro (y no se crea nada)", async () => {
    const world = makeWorld();
    world.disableStorage();
    const { result } = await createImageUpload("evt_A", { filename: "x.png", mimeType: "image/png", sizeBytes: 100 }, world.deps);
    expect(result).toEqual({ ok: false, code: "not_configured", message: mediaMessages.notConfigured });
    expect(world.repo.assets.size).toBe(0);
  });
});
