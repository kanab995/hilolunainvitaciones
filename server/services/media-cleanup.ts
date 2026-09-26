import { getServerNow } from "@/lib/invitation/server-time";
import { logger } from "@/server/observability/logger";
import { prismaMediaRepository } from "@/server/repositories/media";
import { listOrphanCandidates, summarizeOrphanCandidates, type OrphanCandidate, type OrphanReason, type OrphanSummary } from "@/server/repositories/media-orphans";
import { getStorageProvider } from "@/server/storage";
import type { StorageProvider } from "@/server/storage/provider";

/**
 * DETECCIÓN Y LIMPIEZA MANUAL DE ARCHIVOS HUÉRFANOS (preproducción). NO hay tarea programada: se ejecuta a mano (`npm run media:orphans`) o se
 * analiza desde la consola de administración.
 *  - `findOrphanMediaAssets()`: SOLO LEE. Devuelve los candidatos y sus totales.
 *  - `cleanupOrphanMediaAssets({ dryRun })`: por defecto `dryRun = true` (no toca nada). Con `dryRun: false`, cada candidato se VUELVE A COMPROBAR
 *    (`countReferences`, que incluye la publicación vigente) justo antes de borrarlo: un archivo con cualquier referencia se salta. Se borra
 *    primero el objeto del almacenamiento y solo si eso funcionó se marca `DELETED` (el registro se conserva como constancia). Un fallo
 *    nunca detiene la limpieza y nunca deja un registro `DELETED` con el objeto vivo.
 *  - Política: `PENDING` con más de 24 h; `READY` sin referencias (borrador ni publicación vigente) con más de 24 h. Nunca un archivo publicado.
 *  - Lotes acotados (`batchLimit`): repetir hasta que no queden candidatos.
 */
export const ORPHAN_POLICY = { pendingGraceHours: 24, readyGraceHours: 24, batchLimit: 200 } as const;

export interface OrphanRow {
  id: string;
  reason: OrphanReason;
  sizeBytes: number;
  createdAt: Date;
}

export interface OrphanReport {
  generatedAt: Date;
  policy: typeof ORPHAN_POLICY;
  totals: OrphanSummary;
  /** Primeros candidatos del lote (sin claves de almacenamiento). */
  sample: OrphanRow[];
  /** Hay más candidatos que el tamaño del lote. */
  truncated: boolean;
}

export interface CleanupReport {
  dryRun: boolean;
  considered: number;
  bytesConsidered: number;
  deleted: number;
  skippedReferenced: number;
  failed: number;
  /** El almacenamiento no está configurado: no se puede borrar ningún objeto. */
  storageUnavailable: boolean;
}

export interface MediaCleanupDeps {
  listCandidates: (cutoffs: { pending: Date; ready: Date }, limit: number) => Promise<OrphanCandidate[]>;
  summarize: (cutoffs: { pending: Date; ready: Date }) => Promise<OrphanSummary>;
  countReferences: (assetId: string) => Promise<number>;
  markDeleted: (assetId: string) => Promise<void>;
  storage: () => StorageProvider | undefined;
  now: () => Date;
}

const defaultDeps: MediaCleanupDeps = {
  listCandidates: listOrphanCandidates,
  summarize: summarizeOrphanCandidates,
  countReferences: (id) => prismaMediaRepository.countReferences(id),
  markDeleted: (id) => prismaMediaRepository.markDeleted(id),
  storage: getStorageProvider,
  now: () => new Date(getServerNow()),
};

const cutoffsAt = (now: Date) => ({ pending: new Date(now.getTime() - ORPHAN_POLICY.pendingGraceHours * 3_600_000), ready: new Date(now.getTime() - ORPHAN_POLICY.readyGraceHours * 3_600_000) });

export async function findOrphanMediaAssets(deps: MediaCleanupDeps = defaultDeps): Promise<OrphanReport> {
  const now = deps.now();
  const cutoffs = cutoffsAt(now);
  const [totals, candidates] = await Promise.all([deps.summarize(cutoffs), deps.listCandidates(cutoffs, ORPHAN_POLICY.batchLimit)]);
  return {
    generatedAt: now,
    policy: ORPHAN_POLICY,
    totals,
    sample: candidates.map(({ id, reason, sizeBytes, createdAt }) => ({ id, reason, sizeBytes, createdAt })),
    truncated: totals.count > candidates.length,
  };
}

export async function cleanupOrphanMediaAssets(options: { dryRun?: boolean } = {}, deps: MediaCleanupDeps = defaultDeps): Promise<CleanupReport> {
  const dryRun = options.dryRun ?? true;
  const cutoffs = cutoffsAt(deps.now());
  const candidates = await deps.listCandidates(cutoffs, ORPHAN_POLICY.batchLimit);
  const report: CleanupReport = { dryRun, considered: candidates.length, bytesConsidered: candidates.reduce((sum, item) => sum + item.sizeBytes, 0), deleted: 0, skippedReferenced: 0, failed: 0, storageUnavailable: false };
  if (dryRun) return report;

  const storage = deps.storage();
  if (!storage) {
    report.storageUnavailable = true;
    return report;
  }
  for (const candidate of candidates) {
    try {
      // Última comprobación: cualquier referencia (borrador o publicación vigente) salva el archivo.
      if ((await deps.countReferences(candidate.id)) > 0) {
        report.skippedReferenced += 1;
        continue;
      }
      await storage.delete(candidate.storageKey);
      await deps.markDeleted(candidate.id);
      report.deleted += 1;
    } catch (error) {
      report.failed += 1;
      logger.error("media.orphan_cleanup_failed", error, { asset: candidate.id });
    }
  }
  logger.info("media.orphan_cleanup", { deleted: report.deleted, skippedReferenced: report.skippedReferenced, failed: report.failed });
  return report;
}
