"use server";

import { adminCopy } from "@/lib/admin/copy";
import { logger } from "@/server/observability/logger";
import { requireAdmin } from "@/server/auth/admin";
import { findOrphanMediaAssets } from "@/server/services/media-cleanup";

/**
 * SERVER ACTION de análisis de archivos huérfanos (preproducción). SOLO LECTURA: calcula cuántos archivos parecen huérfanos y cuánto ocupan; no
 * borra nada (no hay botón destructivo mientras no exista un registro de auditoría de limpieza: la limpieza es manual, `npm run media:orphans`).
 * `requireAdmin()` primero; devuelve solo totales (nada de claves de almacenamiento).
 */
export interface OrphanAnalysisState {
  status: "idle" | "done" | "error";
  message?: string;
  report?: { generatedAt: string; count: number; bytes: number; stalePending: number; unreferencedReady: number; truncated: boolean; batchLimit: number; pendingGraceHours: number; readyGraceHours: number };
}

export async function analyzeOrphansAction(_previous: OrphanAnalysisState): Promise<OrphanAnalysisState> {
  await requireAdmin();
  try {
    const report = await findOrphanMediaAssets();
    return {
      status: "done",
      report: {
        generatedAt: report.generatedAt.toISOString(),
        count: report.totals.count,
        bytes: report.totals.bytes,
        stalePending: report.totals.byReason.stale_pending.count,
        unreferencedReady: report.totals.byReason.unreferenced_ready.count,
        truncated: report.truncated,
        batchLimit: report.policy.batchLimit,
        pendingGraceHours: report.policy.pendingGraceHours,
        readyGraceHours: report.policy.readyGraceHours,
      },
    };
  } catch (error) {
    logger.error("admin.orphan_analysis_failed", error);
    return { status: "error", message: adminCopy.overview.orphans.error };
  }
}
