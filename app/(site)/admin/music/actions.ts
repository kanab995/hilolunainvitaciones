"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminCopy } from "@/lib/admin/copy";
import { routes } from "@/lib/routes";
import {
  createAdminMusicCategory,
  createAdminMusicTrack,
  finalizeAdminMusicUpload,
  requestAdminMusicUpload,
  setAdminMusicTrackStatus,
  updateAdminMusicCategory,
  updateAdminMusicLicense,
  updateAdminMusicTrack,
  verifyAdminMusicLicense,
  type MusicAdminResult,
} from "@/server/admin/music";
import { requireAdmin } from "@/server/auth/admin";
import type { UploadTarget } from "@/server/storage";

/**
 * SERVER ACTIONS de la biblioteca musical (D-46, ampliación de D-33). Finas: `requireAdmin()` PRIMERO (sin sesión → /sign-in; sin rol ADMIN
 * → 404 y no se ejecuta nada), después el servicio valida toda la entrada y escribe con su registro de auditoría. Los mensajes son
 * genéricos (`adminCopy.music.errors`); nunca se devuelven claves de almacenamiento ni detalles internos.
 */
export interface MusicActionState {
  status: "idle" | "saved" | "error";
  message?: string;
  /** Requisitos que faltan (códigos de `ActivationProblem`). */
  problems?: string[];
}

const copy = adminCopy.music;
const errorMessage = (code: string): string => copy.errors[code] ?? copy.errors.invalid ?? "";

function toState(result: MusicAdminResult, saved: string): MusicActionState {
  if (result.ok) return { status: "saved", message: saved };
  return { status: "error", message: errorMessage(result.code), ...(result.problems ? { problems: result.problems } : {}) };
}

function refresh(trackId?: FormDataEntryValue | null): void {
  revalidatePath(routes.adminMusic);
  if (typeof trackId === "string" && trackId) revalidatePath(routes.adminMusicTrack(trackId));
}

export async function createMusicCategoryAction(_previous: MusicActionState, formData: FormData): Promise<MusicActionState> {
  const admin = await requireAdmin();
  const result = await createAdminMusicCategory(admin, { name: formData.get("name"), slug: formData.get("slug"), sortOrder: formData.get("sortOrder"), isActive: formData.get("isActive") });
  refresh();
  return toState(result, copy.categories.saved);
}

export async function updateMusicCategoryAction(_previous: MusicActionState, formData: FormData): Promise<MusicActionState> {
  const admin = await requireAdmin();
  const result = await updateAdminMusicCategory(admin, { categoryId: formData.get("categoryId"), name: formData.get("name"), sortOrder: formData.get("sortOrder"), isActive: formData.get("isActive") });
  refresh();
  return toState(result, copy.categories.saved);
}

export async function createMusicTrackAction(_previous: MusicActionState, formData: FormData): Promise<MusicActionState> {
  const admin = await requireAdmin();
  const result = await createAdminMusicTrack(admin, { title: formData.get("title"), author: formData.get("author"), categoryId: formData.get("categoryId") });
  if (!result.ok) return toState(result, "");
  refresh();
  redirect(routes.adminMusicTrack(result.id));
}

export async function updateMusicTrackAction(_previous: MusicActionState, formData: FormData): Promise<MusicActionState> {
  const admin = await requireAdmin();
  const trackId = formData.get("trackId");
  const result = await updateAdminMusicTrack(admin, { trackId, title: formData.get("title"), author: formData.get("author"), categoryId: formData.get("categoryId") });
  refresh(trackId);
  return toState(result, copy.detail.saved);
}

export async function updateMusicLicenseAction(_previous: MusicActionState, formData: FormData): Promise<MusicActionState> {
  const admin = await requireAdmin();
  const trackId = formData.get("trackId");
  const result = await updateAdminMusicLicense(admin, {
    trackId,
    licenseSource: formData.get("licenseSource"),
    licenseName: formData.get("licenseName"),
    licenseUrl: formData.get("licenseUrl"),
    licenseTerms: formData.get("licenseTerms"),
    licenseEvidenceRef: formData.get("licenseEvidenceRef"),
    rightsHosting: formData.get("rightsHosting"),
    rightsPublicPerformance: formData.get("rightsPublicPerformance"),
    rightsCommercialUse: formData.get("rightsCommercialUse"),
    attributionRequired: formData.get("attributionRequired"),
    attributionText: formData.get("attributionText"),
    licenseExpiresAt: formData.get("licenseExpiresAt"),
  });
  refresh(trackId);
  return toState(result, copy.detail.licenseSaved);
}

export async function verifyMusicLicenseAction(_previous: MusicActionState, formData: FormData): Promise<MusicActionState> {
  const admin = await requireAdmin();
  const trackId = formData.get("trackId");
  const result = await verifyAdminMusicLicense(admin, trackId);
  refresh(trackId);
  return toState(result, copy.detail.saved);
}

export async function setMusicTrackStatusAction(_previous: MusicActionState, formData: FormData): Promise<MusicActionState> {
  const admin = await requireAdmin();
  const trackId = formData.get("trackId");
  const result = await setAdminMusicTrackStatus(admin, { trackId, status: formData.get("status") });
  refresh(trackId);
  return toState(result, copy.detail.saved);
}

export type MusicUploadTicket = { ok: true; upload: UploadTarget; key: string } | { ok: false; message: string };

export async function requestMusicUploadAction(input: { trackId: string; sizeBytes: number; mimeType: string }): Promise<MusicUploadTicket> {
  const admin = await requireAdmin();
  const result = await requestAdminMusicUpload(admin, input);
  return result.ok ? { ok: true, upload: result.upload, key: result.key } : { ok: false, message: errorMessage(result.code) };
}

export async function finalizeMusicUploadAction(input: { trackId: string; key: string; durationSec: number }): Promise<{ ok: boolean; message: string }> {
  const admin = await requireAdmin();
  const result = await finalizeAdminMusicUpload(admin, input);
  refresh(input.trackId);
  return result.ok ? { ok: true, message: copy.detail.uploaded } : { ok: false, message: errorMessage(result.code) };
}
