import { beforeEach, describe, expect, it, vi } from "vitest";
import { documented } from "./fixtures";

const repo = vi.hoisted(() => ({
  listMusicCategories: vi.fn(),
  listMusicTracks: vi.fn(),
  findMusicTrack: vi.fn(),
  createMusicCategory: vi.fn(),
  updateMusicCategory: vi.fn(),
  createMusicTrack: vi.fn(),
  updateMusicTrackMetadata: vi.fn(),
  updateMusicTrackLicense: vi.fn(),
  markMusicTrackVerified: vi.fn(),
  setMusicTrackStatus: vi.fn(),
  setMusicTrackAudio: vi.fn(),
}));
vi.mock("@/server/repositories/music", () => repo);

import {
  createAdminMusicCategory,
  createAdminMusicTrack,
  finalizeAdminMusicUpload,
  parseLicense,
  requestAdminMusicUpload,
  setAdminMusicTrackStatus,
  updateAdminMusicLicense,
  verifyAdminMusicLicense,
  type MusicUploadDeps,
} from "@/server/admin/music";
import type { AdminUser } from "@/server/auth/admin";
import type { StorageProvider } from "@/server/storage";

const admin = { id: "usr_admin", email: "admin@example.com", name: "Admin", role: "ADMIN" } as AdminUser;
const KEY = "library/music/trk_1-0123456789abcdef0123456789abcdef.mp3";
const track = (over: Record<string, unknown> = {}) => ({ ...documented(), id: "trk_1", title: "Vals", author: "Autora", categoryId: "mcat_romantica", category: { id: "mcat_romantica", slug: "romantica", name: "Romántica", isActive: true }, ...over });

beforeEach(() => {
  for (const fn of Object.values(repo)) fn.mockReset();
});

describe("consola: activar una pista exige toda la documentación", () => {
  it("con requisitos pendientes NO se activa y se devuelve la lista; con todo completo, sí", async () => {
    repo.findMusicTrack.mockResolvedValue(track({ rightsCommercialUse: false, licenseVerifiedAt: null }));
    expect(await setAdminMusicTrackStatus(admin, { trackId: "trk_1", status: "ACTIVE" })).toEqual({ ok: false, code: "problems", problems: ["rightsCommercialUse", "verification"] });
    expect(repo.setMusicTrackStatus).not.toHaveBeenCalled();

    repo.findMusicTrack.mockResolvedValue(track());
    expect(await setAdminMusicTrackStatus(admin, { trackId: "trk_1", status: "ACTIVE" })).toEqual({ ok: true });
    expect(repo.setMusicTrackStatus).toHaveBeenCalledWith("trk_1", "ACTIVE", "usr_admin");
  });

  it("desactivar no exige nada (siempre se puede silenciar una pista); un estado inventado se rechaza", async () => {
    repo.findMusicTrack.mockResolvedValue(track({ status: "ACTIVE", rightsHosting: false }));
    expect(await setAdminMusicTrackStatus(admin, { trackId: "trk_1", status: "DISABLED" })).toEqual({ ok: true });
    expect(await setAdminMusicTrackStatus(admin, { trackId: "trk_1", status: "PUBLISHED" })).toEqual({ ok: false, code: "invalid" });
    expect(await setAdminMusicTrackStatus(admin, { trackId: "../x", status: "DRAFT" })).toEqual({ ok: false, code: "invalid" });
  });

  it("solo se VERIFICA documentación completa, con el administrador y la fecha", async () => {
    repo.findMusicTrack.mockResolvedValue(track({ licenseEvidenceRef: null, licenseVerifiedAt: null }));
    expect(await verifyAdminMusicLicense(admin, "trk_1")).toMatchObject({ ok: false, code: "documentation", problems: ["licenseEvidence"] });
    expect(repo.markMusicTrackVerified).not.toHaveBeenCalled();
    repo.findMusicTrack.mockResolvedValue(track({ audioKey: null, licenseVerifiedAt: null }));
    expect(await verifyAdminMusicLicense(admin, "trk_1")).toEqual({ ok: true });
    expect(repo.markMusicTrackVerified).toHaveBeenCalledWith("trk_1", "usr_admin", expect.any(Date));
  });

  it("la licencia de una pista ACTIVA no se cambia (el repositorio lo rechaza y el servicio lo propaga)", async () => {
    repo.updateMusicTrackLicense.mockResolvedValue("active");
    const form = { trackId: "trk_1", licenseSource: "x", licenseName: "y", licenseUrl: "", licenseTerms: "z", licenseEvidenceRef: "w", rightsHosting: "on", rightsPublicPerformance: "on", rightsCommercialUse: "on", attributionRequired: null, attributionText: "", licenseExpiresAt: "" };
    expect(await updateAdminMusicLicense(admin, form)).toEqual({ ok: false, code: "active" });
  });
});

describe("consola: validación de formularios", () => {
  it("la licencia admite guardarse incompleta, interpreta casillas y fechas y rechaza formatos inválidos", () => {
    expect(parseLicense({ trackId: "trk_1", licenseSource: " Compositora ", licenseName: "", licenseUrl: null, licenseTerms: undefined, licenseEvidenceRef: "", rightsHosting: "on", rightsPublicPerformance: null, rightsCommercialUse: "on", attributionRequired: null, attributionText: "", licenseExpiresAt: "2030-12-31" })).toEqual({
      licenseSource: "Compositora",
      licenseName: null,
      licenseUrl: null,
      licenseTerms: null,
      licenseEvidenceRef: null,
      attributionText: null,
      rightsHosting: true,
      rightsPublicPerformance: false,
      rightsCommercialUse: true,
      attributionRequired: false,
      licenseExpiresAt: new Date("2030-12-31T23:59:59.999Z"),
    });
    expect(parseLicense({ trackId: "trk_1", licenseSource: "x".repeat(500), licenseName: null, licenseUrl: null, licenseTerms: null, licenseEvidenceRef: null, rightsHosting: null, rightsPublicPerformance: null, rightsCommercialUse: null, attributionRequired: null, attributionText: null, licenseExpiresAt: "" })).toBeNull();
    expect(parseLicense({ trackId: "trk_1", licenseSource: null, licenseName: null, licenseUrl: null, licenseTerms: null, licenseEvidenceRef: null, rightsHosting: null, rightsPublicPerformance: null, rightsCommercialUse: null, attributionRequired: null, attributionText: null, licenseExpiresAt: "31/12/2030" })).toBeNull();
  });

  it("categorías y pistas: campos obligatorios, slug con formato; una pista nueva nunca nace activa", async () => {
    expect(await createAdminMusicCategory(admin, { name: "Bodas", slug: "Bodas Bonitas", sortOrder: "10", isActive: "on" })).toEqual({ ok: false, code: "invalid" });
    repo.createMusicCategory.mockResolvedValue({ ok: true, id: "mcat_bodas" });
    expect(await createAdminMusicCategory(admin, { name: "Bodas", slug: "bodas", sortOrder: "10", isActive: "on" })).toEqual({ ok: true });
    expect(repo.createMusicCategory).toHaveBeenCalledWith({ name: "Bodas", slug: "bodas", sortOrder: 10, isActive: true }, "usr_admin");
    expect(await createAdminMusicTrack(admin, { title: "", author: "x", categoryId: "mcat_bodas" })).toEqual({ ok: false, code: "invalid" });
    repo.createMusicTrack.mockResolvedValue({ ok: true, id: "trk_new" });
    expect(await createAdminMusicTrack(admin, { title: "Vals", author: "Autora", categoryId: "mcat_bodas", status: "ACTIVE" } as never)).toEqual({ ok: true, id: "trk_new" });
    expect(repo.createMusicTrack).toHaveBeenCalledWith({ title: "Vals", author: "Autora", categoryId: "mcat_bodas" }, "usr_admin");
  });
});

function storage(bytes: number[] | undefined, size = 3_000_000) {
  const provider = {
    createUploadTarget: vi.fn(async () => ({ url: "https://bucket.example/put", method: "PUT" as const, headers: { "Content-Type": "audio/mpeg" }, expiresAt: new Date() })),
    head: vi.fn(async () => (bytes ? { sizeBytes: size } : undefined)),
    readStart: vi.fn(async () => (bytes ? new Uint8Array(bytes) : undefined)),
    readAll: vi.fn(),
    writeObject: vi.fn(),
    delete: vi.fn(async () => undefined),
  } satisfies StorageProvider;
  const deps: MusicUploadDeps = { storage: () => provider, newKey: () => KEY };
  return { provider, deps };
}

describe("consola: subida del MP3", () => {
  it("solo MP3, dentro del límite, para una pista NO activa; sin almacenamiento configurado se avisa", async () => {
    const { deps, provider } = storage([0x49, 0x44, 0x33]);
    repo.findMusicTrack.mockResolvedValue(track({ status: "DRAFT" }));
    expect(await requestAdminMusicUpload(admin, { trackId: "trk_1", sizeBytes: 1000, mimeType: "audio/wav" }, deps)).toEqual({ ok: false, code: "invalid" });
    expect(await requestAdminMusicUpload(admin, { trackId: "trk_1", sizeBytes: 50 * 1024 * 1024, mimeType: "audio/mpeg" }, deps)).toEqual({ ok: false, code: "invalid" });
    expect(await requestAdminMusicUpload(admin, { trackId: "trk_1", sizeBytes: 1000, mimeType: "audio/mpeg" }, { ...deps, storage: () => undefined })).toEqual({ ok: false, code: "storage" });
    const ok = await requestAdminMusicUpload(admin, { trackId: "trk_1", sizeBytes: 1000, mimeType: "audio/mpeg" }, deps);
    expect(ok).toMatchObject({ ok: true, key: KEY });
    expect(provider.createUploadTarget).toHaveBeenCalledWith({ key: KEY, mimeType: "audio/mpeg", sizeBytes: 1000 });
    repo.findMusicTrack.mockResolvedValue(track({ status: "ACTIVE" }));
    expect(await requestAdminMusicUpload(admin, { trackId: "trk_1", sizeBytes: 1000, mimeType: "audio/mpeg" }, deps)).toEqual({ ok: false, code: "active" });
  });

  it("al finalizar se comprueba el ARCHIVO REAL: un no-MP3 se borra y no se asigna", async () => {
    const { deps, provider } = storage([0x89, 0x50, 0x4e, 0x47]);
    expect(await finalizeAdminMusicUpload(admin, { trackId: "trk_1", key: KEY, durationSec: 120 }, deps)).toEqual({ ok: false, code: "upload" });
    expect(provider.delete).toHaveBeenCalledWith(KEY);
    expect(repo.setMusicTrackAudio).not.toHaveBeenCalled();
  });

  it("una clave de otra pista o de un cliente, o una duración fuera de rango, se rechazan sin tocar el almacenamiento", async () => {
    const { deps, provider } = storage([0x49, 0x44, 0x33]);
    expect(await finalizeAdminMusicUpload(admin, { trackId: "trk_2", key: KEY, durationSec: 120 }, deps)).toEqual({ ok: false, code: "invalid" });
    expect(await finalizeAdminMusicUpload(admin, { trackId: "trk_1", key: "users/u/events/e/0123456789abcdef0123456789abcdef.png", durationSec: 120 }, deps)).toEqual({ ok: false, code: "invalid" });
    expect(await finalizeAdminMusicUpload(admin, { trackId: "trk_1", key: KEY, durationSec: 5 }, deps)).toEqual({ ok: false, code: "invalid" });
    expect(provider.head).not.toHaveBeenCalled();
  });

  it("un MP3 válido se asigna y el audio ANTERIOR se borra (la pista no estaba activa)", async () => {
    const { deps, provider } = storage([0x49, 0x44, 0x33], 2_500_000);
    repo.setMusicTrackAudio.mockResolvedValue({ ok: true, previousKey: "library/music/trk_1-ffffffffffffffffffffffffffffffff.mp3" });
    expect(await finalizeAdminMusicUpload(admin, { trackId: "trk_1", key: KEY, durationSec: 184.6 }, deps)).toEqual({ ok: true });
    expect(repo.setMusicTrackAudio).toHaveBeenCalledWith("trk_1", { audioKey: KEY, audioMimeType: "audio/mpeg", audioSizeBytes: 2_500_000, durationSec: 185 }, "usr_admin");
    expect(provider.delete).toHaveBeenCalledWith("library/music/trk_1-ffffffffffffffffffffffffffffffff.mp3");
  });

  it("si la pista se activó mientras se subía, el archivo nuevo se descarta", async () => {
    const { deps, provider } = storage([0xff, 0xfb]);
    repo.setMusicTrackAudio.mockResolvedValue({ ok: false, code: "active" });
    expect(await finalizeAdminMusicUpload(admin, { trackId: "trk_1", key: KEY, durationSec: 120 }, deps)).toEqual({ ok: false, code: "active" });
    expect(provider.delete).toHaveBeenCalledWith(KEY);
  });
});
