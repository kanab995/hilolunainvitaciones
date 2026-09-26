import { getDataSource } from "@/server/data-source";
import { prisma } from "@/server/db/client";
import { StoreUnavailableError } from "@/server/db/errors";

/**
 * ARCHIVOS HUÉRFANOS (preproducción). ÚNICA definición en SQL de «huérfano»; la usan el análisis manual, la limpieza y el resumen de la consola.
 *  - `stale_pending`: subida `PENDING` (URL firmada emitida, archivo nunca verificado) anterior al corte.
 *  - `unreferenced_ready`: archivo `READY` anterior al corte que NINGUNA referencia usa: ni portada, galería o sedes del BORRADOR, ni la
 *    publicación VIGENTE (D-29: la vigente es la que retiene sus archivos). Un archivo publicado NUNCA es candidato.
 * Solo lectura. Texto SQL fijo; los únicos parámetros son fechas y el límite (ningún dato del usuario). Sin base de datos: error explícito.
 */
export type OrphanReason = "stale_pending" | "unreferenced_ready";

export interface OrphanCandidate {
  id: string;
  storageKey: string;
  sizeBytes: number;
  status: "PENDING" | "READY";
  reason: OrphanReason;
  createdAt: Date;
}

export interface OrphanSummary {
  count: number;
  bytes: number;
  byReason: Record<OrphanReason, { count: number; bytes: number }>;
}

const requireDatabase = () => {
  if (getDataSource() === "demo") throw new StoreUnavailableError();
};

export async function listOrphanCandidates(cutoffs: { pending: Date; ready: Date }, limit: number): Promise<OrphanCandidate[]> {
  requireDatabase();
  const rows = await prisma.$queryRaw<Array<{ id: string; storageKey: string; sizeBytes: number; status: "PENDING" | "READY"; reason: OrphanReason; createdAt: Date }>>`
    SELECT m."id", m."storageKey", m."sizeBytes", m."status"::text AS "status",
           CASE WHEN m."status" = 'PENDING' THEN 'stale_pending' ELSE 'unreferenced_ready' END AS "reason", m."createdAt"
    FROM "MediaAsset" m
    WHERE (m."status" = 'PENDING' AND m."createdAt" < ${cutoffs.pending})
       OR (m."status" = 'READY' AND m."createdAt" < ${cutoffs.ready}
           AND NOT EXISTS (SELECT 1 FROM "Invitation" i WHERE i."coverMediaId" = m."id")
           AND NOT EXISTS (SELECT 1 FROM "GalleryImage" g WHERE g."mediaAssetId" = m."id")
           AND NOT EXISTS (SELECT 1 FROM "Location" l WHERE l."mediaAssetId" = m."id")
           AND NOT EXISTS (SELECT 1 FROM "InvitationPublication" p WHERE p."isCurrent" AND m."id" = ANY(p."mediaAssetIds")))
    ORDER BY m."createdAt" ASC
    LIMIT ${limit}`;
  return rows;
}

export async function summarizeOrphanCandidates(cutoffs: { pending: Date; ready: Date }): Promise<OrphanSummary> {
  requireDatabase();
  const rows = await prisma.$queryRaw<Array<{ reason: OrphanReason; count: number; bytes: number }>>`
    SELECT CASE WHEN m."status" = 'PENDING' THEN 'stale_pending' ELSE 'unreferenced_ready' END AS "reason",
           COUNT(*)::float8 AS "count", COALESCE(SUM(m."sizeBytes"), 0)::float8 AS "bytes"
    FROM "MediaAsset" m
    WHERE (m."status" = 'PENDING' AND m."createdAt" < ${cutoffs.pending})
       OR (m."status" = 'READY' AND m."createdAt" < ${cutoffs.ready}
           AND NOT EXISTS (SELECT 1 FROM "Invitation" i WHERE i."coverMediaId" = m."id")
           AND NOT EXISTS (SELECT 1 FROM "GalleryImage" g WHERE g."mediaAssetId" = m."id")
           AND NOT EXISTS (SELECT 1 FROM "Location" l WHERE l."mediaAssetId" = m."id")
           AND NOT EXISTS (SELECT 1 FROM "InvitationPublication" p WHERE p."isCurrent" AND m."id" = ANY(p."mediaAssetIds")))
    GROUP BY 1`;
  const empty = () => ({ count: 0, bytes: 0 });
  const byReason: OrphanSummary["byReason"] = { stale_pending: empty(), unreferenced_ready: empty() };
  for (const row of rows) byReason[row.reason] = { count: Number(row.count), bytes: Number(row.bytes) };
  return { count: byReason.stale_pending.count + byReason.unreferenced_ready.count, bytes: byReason.stale_pending.bytes + byReason.unreferenced_ready.bytes, byReason };
}
