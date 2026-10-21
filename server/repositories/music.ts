import type { Prisma } from "@prisma/client";
import type { MusicTrackStatusId } from "@/lib/music/limits";
import type { TrackRightsRecord } from "@/lib/music/license";
import { getDataSource } from "@/server/data-source";
import { prisma } from "@/server/db/client";
import { StoreUnavailableError } from "@/server/db/errors";

/**
 * BIBLIOTECA MUSICAL (D-46): acceso a datos. Único módulo que conoce Prisma para música (CLAUDE.md regla 13).
 *  - Lecturas para el EDITOR y la INVITACIÓN pública: devuelven los campos de derechos para que el servicio decida con
 *    `isTrackPlayable` (una sola regla); nunca exponen al cliente la clave de almacenamiento.
 *  - Escrituras de la CONSOLA (D-33 ampliada): cada cambio va en UNA transacción junto con su fila de `AdminAuditLog` (antes/después
 *    solo de lo que cambió). Ninguna borra datos: una pista se desactiva, una categoría se oculta.
 * Sin base de datos (modo demostración) la biblioteca está vacía y las escrituras fallan con `StoreUnavailableError`.
 */
function requireDatabase(): void {
  if (getDataSource() === "demo") throw new StoreUnavailableError();
}

const rightsSelect = {
  status: true,
  audioKey: true,
  durationSec: true,
  licenseSource: true,
  licenseName: true,
  licenseUrl: true,
  licenseTerms: true,
  licenseEvidenceRef: true,
  rightsHosting: true,
  rightsPublicPerformance: true,
  rightsCommercialUse: true,
  attributionRequired: true,
  attributionText: true,
  licenseVerifiedAt: true,
  licenseVerifiedById: true,
  licenseExpiresAt: true,
} as const;

const trackSelect = {
  id: true,
  title: true,
  author: true,
  categoryId: true,
  audioMimeType: true,
  audioSizeBytes: true,
  createdAt: true,
  updatedAt: true,
  ...rightsSelect,
  category: { select: { id: true, slug: true, name: true, isActive: true } },
  verifiedBy: { select: { name: true, email: true } },
  _count: { select: { selections: true } },
} as const;

export interface MusicCategoryRow {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  trackCount: number;
}

export interface MusicTrackRow extends TrackRightsRecord {
  id: string;
  title: string;
  author: string;
  categoryId: string;
  category: { id: string; slug: string; name: string; isActive: boolean };
  audioMimeType: string | null;
  audioSizeBytes: number | null;
  verifiedBy: { name: string | null; email: string } | null;
  /** Eventos que la tienen elegida (borrador). */
  selectionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

type TrackRecord = Prisma.MusicTrackGetPayload<{ select: typeof trackSelect }>;

const toTrackRow = ({ _count, status, ...row }: TrackRecord): MusicTrackRow => ({ ...row, status: status as MusicTrackStatusId, selectionCount: _count.selections });

// ───────── Lecturas ─────────

export async function listMusicCategories(): Promise<MusicCategoryRow[]> {
  if (getDataSource() === "demo") return [];
  const rows = await prisma.musicCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, slug: true, name: true, sortOrder: true, isActive: true, _count: { select: { tracks: true } } } });
  return rows.map(({ _count, ...row }) => ({ ...row, trackCount: _count.tracks }));
}

export async function listMusicTracks(): Promise<MusicTrackRow[]> {
  requireDatabase();
  const rows = await prisma.musicTrack.findMany({ orderBy: [{ category: { sortOrder: "asc" } }, { title: "asc" }], select: trackSelect });
  return rows.map(toTrackRow);
}

export async function findMusicTrack(id: string): Promise<MusicTrackRow | undefined> {
  requireDatabase();
  const row = await prisma.musicTrack.findUnique({ where: { id }, select: trackSelect });
  return row ? toTrackRow(row) : undefined;
}

/** Candidatas para el EDITOR: `ACTIVE` y de una categoría visible (el servicio vuelve a aplicar `isTrackPlayable`: vencimientos). */
export async function listActiveLibraryTracks(): Promise<MusicTrackRow[]> {
  if (getDataSource() === "demo") return [];
  const rows = await prisma.musicTrack.findMany({ where: { status: "ACTIVE", category: { isActive: true } }, orderBy: [{ category: { sortOrder: "asc" } }, { title: "asc" }], select: trackSelect });
  return rows.map(toTrackRow);
}

/** Una pista por id para RESOLVER lo que suena (sin filtrar por categoría: ocultar una categoría solo afecta a nuevas selecciones). */
export async function findTrackForPlayback(id: string): Promise<MusicTrackRow | undefined> {
  if (getDataSource() === "demo") return undefined;
  const row = await prisma.musicTrack.findUnique({ where: { id }, select: trackSelect });
  return row ? toTrackRow(row) : undefined;
}

// ───────── Escrituras de la consola (con auditoría) ─────────

type Tx = Prisma.TransactionClient;
type Plain = Record<string, string | number | boolean | null>;

const serialize = (value: unknown): string | number | boolean | null => (value instanceof Date ? value.toISOString() : (value as string | number | boolean | null) ?? null);

/** Solo las claves que cambian, en ambos lados (el registro nunca guarda textos que no se tocaron). */
function diff(before: Record<string, unknown>, after: Record<string, unknown>): { before: Plain; after: Plain } {
  const b: Plain = {};
  const a: Plain = {};
  for (const key of Object.keys(after)) {
    const prev = serialize(before[key]);
    const next = serialize(after[key]);
    if (prev !== next) {
      b[key] = prev;
      a[key] = next;
    }
  }
  return { before: b, after: a };
}

async function audit(tx: Tx, adminUserId: string, action: string, entityType: "MusicTrack" | "MusicCategory", entityId: string, change: { before: Plain; after: Plain }): Promise<void> {
  if (Object.keys(change.after).length === 0) return;
  await tx.adminAuditLog.create({ data: { adminUserId, action, entityType, entityId, before: change.before, after: change.after } });
}

export interface CategoryWrite {
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
}

export async function createMusicCategory(data: CategoryWrite, adminUserId: string): Promise<{ ok: true; id: string } | { ok: false; code: "duplicate" }> {
  requireDatabase();
  return prisma.$transaction(async (tx) => {
    if (await tx.musicCategory.findUnique({ where: { slug: data.slug }, select: { id: true } })) return { ok: false as const, code: "duplicate" as const };
    const row = await tx.musicCategory.create({ data, select: { id: true } });
    await audit(tx, adminUserId, "music.category.create", "MusicCategory", row.id, diff({}, { ...data }));
    return { ok: true as const, id: row.id };
  });
}

/** El `slug` no se cambia (identifica la categoría). */
export async function updateMusicCategory(id: string, data: Omit<CategoryWrite, "slug">, adminUserId: string): Promise<boolean> {
  requireDatabase();
  return prisma.$transaction(async (tx) => {
    const before = await tx.musicCategory.findUnique({ where: { id }, select: { name: true, sortOrder: true, isActive: true } });
    if (!before) return false;
    await tx.musicCategory.update({ where: { id }, data });
    await audit(tx, adminUserId, "music.category.update", "MusicCategory", id, diff(before, { ...data }));
    return true;
  });
}

export interface TrackMetadataWrite {
  title: string;
  author: string;
  categoryId: string;
}

export async function createMusicTrack(data: TrackMetadataWrite, adminUserId: string): Promise<{ ok: true; id: string } | { ok: false; code: "category" }> {
  requireDatabase();
  return prisma.$transaction(async (tx) => {
    if (!(await tx.musicCategory.findUnique({ where: { id: data.categoryId }, select: { id: true } }))) return { ok: false as const, code: "category" as const };
    // Siempre nace en DRAFT: nada se publica al crear.
    const row = await tx.musicTrack.create({ data: { ...data, status: "DRAFT" }, select: { id: true } });
    await audit(tx, adminUserId, "music.track.create", "MusicTrack", row.id, diff({}, { ...data, status: "DRAFT" }));
    return { ok: true as const, id: row.id };
  });
}

export async function updateMusicTrackMetadata(id: string, data: TrackMetadataWrite, adminUserId: string): Promise<"ok" | "not_found" | "category"> {
  requireDatabase();
  return prisma.$transaction(async (tx) => {
    const before = await tx.musicTrack.findUnique({ where: { id }, select: { title: true, author: true, categoryId: true } });
    if (!before) return "not_found";
    if (!(await tx.musicCategory.findUnique({ where: { id: data.categoryId }, select: { id: true } }))) return "category";
    await tx.musicTrack.update({ where: { id }, data });
    await audit(tx, adminUserId, "music.track.update", "MusicTrack", id, diff(before, { ...data }));
    return "ok";
  });
}

export interface TrackLicenseWrite {
  licenseSource: string | null;
  licenseName: string | null;
  licenseUrl: string | null;
  licenseTerms: string | null;
  licenseEvidenceRef: string | null;
  rightsHosting: boolean;
  rightsPublicPerformance: boolean;
  rightsCommercialUse: boolean;
  attributionRequired: boolean;
  attributionText: string | null;
  licenseExpiresAt: Date | null;
}

/**
 * Cambiar la documentación ANULA la verificación anterior (hay que volver a verificar). Con la pista `ACTIVE` no se permite: primero se
 * desactiva (la restricción de la base de datos lo impediría igualmente).
 */
export async function updateMusicTrackLicense(id: string, data: TrackLicenseWrite, adminUserId: string): Promise<"ok" | "not_found" | "active"> {
  requireDatabase();
  return prisma.$transaction(async (tx) => {
    const before = await tx.musicTrack.findUnique({ where: { id }, select: { status: true, licenseSource: true, licenseName: true, licenseUrl: true, licenseTerms: true, licenseEvidenceRef: true, rightsHosting: true, rightsPublicPerformance: true, rightsCommercialUse: true, attributionRequired: true, attributionText: true, licenseExpiresAt: true, licenseVerifiedAt: true, licenseVerifiedById: true } });
    if (!before) return "not_found";
    if (before.status === "ACTIVE") return "active";
    const change = diff(before, { ...data });
    if (Object.keys(change.after).length === 0) return "ok";
    await tx.musicTrack.update({ where: { id }, data: { ...data, licenseVerifiedAt: null, licenseVerifiedById: null } });
    await audit(tx, adminUserId, "music.track.license", "MusicTrack", id, diff(before, { ...data, licenseVerifiedAt: null, licenseVerifiedById: null }));
    return "ok";
  });
}

/** El administrador CERTIFICA que revisó la documentación (fecha y autor de la verificación). La validez la decide el servicio. */
export async function markMusicTrackVerified(id: string, adminUserId: string, now: Date): Promise<boolean> {
  requireDatabase();
  return prisma.$transaction(async (tx) => {
    const before = await tx.musicTrack.findUnique({ where: { id }, select: { licenseVerifiedAt: true, licenseVerifiedById: true } });
    if (!before) return false;
    await tx.musicTrack.update({ where: { id }, data: { licenseVerifiedAt: now, licenseVerifiedById: adminUserId } });
    await audit(tx, adminUserId, "music.track.verify", "MusicTrack", id, diff(before, { licenseVerifiedAt: now, licenseVerifiedById: adminUserId }));
    return true;
  });
}

export async function setMusicTrackStatus(id: string, status: MusicTrackStatusId, adminUserId: string): Promise<boolean> {
  requireDatabase();
  return prisma.$transaction(async (tx) => {
    const before = await tx.musicTrack.findUnique({ where: { id }, select: { status: true } });
    if (!before) return false;
    await tx.musicTrack.update({ where: { id }, data: { status } });
    await audit(tx, adminUserId, "music.track.status", "MusicTrack", id, diff(before, { status }));
    return true;
  });
}

export interface TrackAudioWrite {
  audioKey: string;
  audioMimeType: string;
  audioSizeBytes: number;
  durationSec: number;
}

/** Devuelve la clave ANTERIOR (para borrar el objeto viejo) o `"active"` si la pista está publicada (no se reemplaza el audio en uso). */
export async function setMusicTrackAudio(id: string, data: TrackAudioWrite, adminUserId: string): Promise<{ ok: true; previousKey: string | null } | { ok: false; code: "not_found" | "active" }> {
  requireDatabase();
  return prisma.$transaction(async (tx) => {
    const before = await tx.musicTrack.findUnique({ where: { id }, select: { status: true, audioKey: true, audioMimeType: true, audioSizeBytes: true, durationSec: true } });
    if (!before) return { ok: false as const, code: "not_found" as const };
    if (before.status === "ACTIVE") return { ok: false as const, code: "active" as const };
    await tx.musicTrack.update({ where: { id }, data });
    // La clave del objeto no entra en el registro (solo tamaño y duración).
    await audit(tx, adminUserId, "music.track.audio", "MusicTrack", id, diff({ audioSizeBytes: before.audioSizeBytes, durationSec: before.durationSec }, { audioSizeBytes: data.audioSizeBytes, durationSec: data.durationSec }));
    return { ok: true as const, previousKey: before.audioKey };
  });
}

/** Nombres para el registro de auditoría (`/admin/audit`). */
export async function findMusicEntityNames(trackIds: readonly string[], categoryIds: readonly string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (getDataSource() === "demo") return names;
  const [tracks, categories] = await Promise.all([
    trackIds.length ? prisma.musicTrack.findMany({ where: { id: { in: [...trackIds] } }, select: { id: true, title: true } }) : [],
    categoryIds.length ? prisma.musicCategory.findMany({ where: { id: { in: [...categoryIds] } }, select: { id: true, name: true } }) : [],
  ]);
  for (const track of tracks) names.set(track.id, track.title);
  for (const category of categories) names.set(category.id, category.name);
  return names;
}
