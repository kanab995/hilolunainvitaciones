import { vi } from "vitest";
import type { OwnedEventResolution } from "@/server/auth/ownership";
import type { MediaAssetRecord, MediaRepository } from "@/server/repositories/media";
import type { MediaServiceDeps } from "@/server/services/media-service";
import { buildMediaKey } from "@/server/storage/keys";
import type { StorageProvider } from "@/server/storage/provider";
import { buildMediaUrl } from "@/server/storage/public-url";

/**
 * MUNDO DE PRUEBA de los archivos gestionados. Ninguna prueba lee credenciales ni toca un bucket real:
 *  - `FakeStorageProvider`: el «bucket» es un `Map` en memoria.
 *  - `FakeMediaRepository`: aplica el MISMO alcance que el real (propietario + evento en cada búsqueda).
 *  - Dos personas: A (`usr_A`, evento `evt_A`) y B (`usr_B`, evento `evt_B`).
 */
export const PUBLIC_BASE = "https://media.test";

export class FakeStorageProvider implements StorageProvider {
  readonly objects = new Map<string, Uint8Array>();
  readonly deleted: string[] = [];
  /** Claves reescritas por el servidor (imagen normalizada). */
  readonly written: string[] = [];
  readonly targets: { key: string; mimeType: string; sizeBytes: number }[] = [];
  failDelete = false;

  async createUploadTarget(input: { key: string; mimeType: string; sizeBytes: number }) {
    this.targets.push(input);
    return { url: `https://upload.test/${input.key}?signature=temporal`, method: "PUT" as const, headers: { "Content-Type": input.mimeType }, expiresAt: new Date(Date.now() + 60_000) };
  }
  async head(key: string) {
    const object = this.objects.get(key);
    return object ? { sizeBytes: object.byteLength } : undefined;
  }
  async readStart(key: string, length: number) {
    return this.objects.get(key)?.slice(0, length);
  }
  async readAll(key: string) {
    return this.objects.get(key);
  }
  async writeObject(key: string, body: Uint8Array) {
    this.written.push(key);
    this.objects.set(key, body);
  }
  async delete(key: string) {
    if (this.failDelete) throw new Error("fallo del almacenamiento (bucket secreto-bucket, clave AKIASECRETA)");
    this.deleted.push(key);
    this.objects.delete(key);
  }
  /** Simula que el navegador subió `bytes` a la clave (lo que hace el PUT firmado). */
  put(key: string, bytes: Uint8Array) {
    this.objects.set(key, bytes);
  }
}

interface AssetRow extends MediaAssetRecord {
  originalFilename: string;
}

export class FakeMediaRepository implements MediaRepository {
  assets = new Map<string, AssetRow>();
  /** eventId → propietario */
  events = new Map<string, string>();
  slugs = new Map<string, string>();
  cover = new Map<string, { assetId: string | null; alt: string }>();
  gallery: { id: string; eventId: string; assetId: string | null; src: string | null; alt: string; position: number }[] = [];
  locations: { id: string; eventId: string; assetId: string | null; alt: string }[] = [];
  /** Assets que la publicación VIGENTE referencia (D-29): protegen el archivo aunque el borrador ya no lo use. */
  publishedAssetIds = new Set<string>();
  /** Revisión del borrador: cada operación que lo cambia la sube. */
  revision = 1;
  private seq = 0;

  async createPending(data: Parameters<MediaRepository["createPending"]>[0]) {
    const row: AssetRow = { id: `ast_${++this.seq}`, ownerId: data.ownerId, eventId: data.eventId, storageKey: data.storageKey, mimeType: data.mimeType, sizeBytes: data.sizeBytes, width: null, height: null, status: "PENDING", originalFilename: data.originalFilename };
    this.assets.set(row.id, row);
    return { ...row };
  }
  async findOwned(ownerId: string, eventId: string, assetId: string) {
    const row = this.assets.get(assetId);
    return row && row.ownerId === ownerId && row.eventId === eventId && this.events.get(eventId) === ownerId ? { ...row } : undefined;
  }
  async markReady(assetId: string, data: { mimeType: string; sizeBytes: number; width: number; height: number }) {
    const row = this.assets.get(assetId);
    if (!row) return undefined;
    if (row.status === "PENDING") Object.assign(row, data, { status: "READY" });
    return { ...row };
  }
  async markDeleted(assetId: string) {
    const row = this.assets.get(assetId);
    if (row) row.status = "DELETED";
  }
  async countReferences(assetId: string) {
    return [...this.cover.values()].filter((c) => c.assetId === assetId).length + this.gallery.filter((g) => g.assetId === assetId).length + this.locations.filter((l) => l.assetId === assetId).length + (this.publishedAssetIds.has(assetId) ? 1 : 0);
  }
  private owns(ownerId: string, eventId: string) {
    return this.events.get(eventId) === ownerId;
  }
  async setCover(ownerId: string, eventId: string, assetId: string | null, alt: string) {
    if (!this.owns(ownerId, eventId)) return undefined;
    const previous = this.cover.get(eventId)?.assetId ?? null;
    this.cover.set(eventId, { assetId, alt: assetId ? alt : "" });
    return { previousAssetId: previous, revision: ++this.revision };
  }
  async addGalleryImage(ownerId: string, eventId: string, assetId: string, alt: string) {
    if (!this.owns(ownerId, eventId)) return undefined;
    const id = `gal_${++this.seq}`;
    this.gallery.push({ id, eventId, assetId, src: null, alt, position: this.gallery.filter((g) => g.eventId === eventId).length });
    return { id, revision: ++this.revision };
  }
  async removeGalleryImage(ownerId: string, eventId: string, galleryId: string) {
    if (!this.owns(ownerId, eventId)) return undefined;
    const index = this.gallery.findIndex((g) => g.id === galleryId && g.eventId === eventId);
    if (index < 0) return undefined;
    const [row] = this.gallery.splice(index, 1);
    return { assetId: row!.assetId, revision: ++this.revision };
  }
  async setLocationImage(ownerId: string, eventId: string, locationId: string, assetId: string | null, alt: string) {
    if (!this.owns(ownerId, eventId)) return undefined;
    const row = this.locations.find((l) => l.id === locationId && l.eventId === eventId);
    if (!row) return undefined;
    const previous = row.assetId;
    row.assetId = assetId;
    if (assetId) row.alt = alt;
    return { previousAssetId: previous, revision: ++this.revision };
  }
  async getSlug(ownerId: string, eventId: string) {
    return this.owns(ownerId, eventId) ? this.slugs.get(eventId) : undefined;
  }
}

export function makeWorld(sessionUser: "usr_A" | "usr_B" | null = "usr_A") {
  const repo = new FakeMediaRepository();
  repo.events.set("evt_A", "usr_A");
  repo.events.set("evt_B", "usr_B");
  repo.slugs.set("evt_A", "boda-a");
  repo.slugs.set("evt_B", "boda-b");
  repo.locations.push({ id: "loc_A", eventId: "evt_A", assetId: null, alt: "" }, { id: "loc_B", eventId: "evt_B", assetId: null, alt: "" });
  repo.gallery.push({ id: "gal_static_A", eventId: "evt_A", assetId: null, src: "/templates/magnolia/gallery-1.png", alt: "Estática", position: 0 });
  const storage = new FakeStorageProvider();
  let storageOn = true;

  const resolveOwnedEvent = vi.fn(async (ref: string): Promise<OwnedEventResolution> => {
    if (!sessionUser) return { status: "unauthenticated" };
    return repo.events.get(ref) === sessionUser
      ? { status: "ok", user: { id: sessionUser, email: `${sessionUser}@example.com`, name: sessionUser }, event: { id: ref, slug: repo.slugs.get(ref) ?? "", title: "Evento", type: "wedding", status: "active", startsAt: "2027-01-01T00:00:00Z", timezone: "UTC" } }
      : { status: "not_found" };
  });

  const deps: MediaServiceDeps = {
    resolveOwnedEvent,
    repo,
    storage: () => (storageOn ? storage : undefined),
    urlFor: (key) => buildMediaUrl(PUBLIC_BASE, key),
    newKey: buildMediaKey,
    checkGalleryLimit: async () => ({ ok: true }),
  };
  return { repo, storage, deps, resolveOwnedEvent, disableStorage: () => (storageOn = false) };
}

/** Bytes mínimos de una imagen válida (solo el encabezado que inspecciona el servidor). */
export function pngBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(64);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

export function jpegBytes(width: number, height: number, orientation?: number): Uint8Array {
  const parts: number[] = [0xff, 0xd8];
  if (orientation) {
    // APP1 Exif con una sola entrada: Orientation (0x0112).
    const tiff = [0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, 0, 0, 0, 0];
    const payload = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
    parts.push(0xff, 0xe1, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload);
  }
  parts.push(0xff, 0xc0, 0, 17, 8, height >> 8, height & 0xff, width >> 8, width & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1);
  return new Uint8Array([...parts, ...new Array(32).fill(0)]);
}

export function webpBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(40);
  bytes.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58, 10, 0, 0, 0, 0, 0, 0, 0]);
  const w = width - 1;
  const h = height - 1;
  bytes.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff, h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 24);
  return bytes;
}

export const SVG_BYTES = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
export const GIF_BYTES = new TextEncoder().encode("GIF89a\u0001\u0000\u0001\u0000");
