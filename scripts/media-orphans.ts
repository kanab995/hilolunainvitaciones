import { prisma } from "@/server/db/client";
import { cleanupOrphanMediaAssets, findOrphanMediaAssets } from "@/server/services/media-cleanup";

/**
 * HERRAMIENTA MANUAL de archivos huérfanos (`npm run media:orphans`). Siempre empieza con un ANÁLISIS (dry run) y no borra nada por defecto.
 *
 *   npm run media:orphans                          → solo análisis
 *   npm run media:orphans -- --apply --confirm=DELETE   → borra el lote (un lote por ejecución); repite hasta que no queden candidatos
 *
 * Necesita `DATABASE_URL` (y las variables `S3_*` para borrar objetos). No hay tarea programada: ejecútala a mano y revisa antes el análisis.
 */
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL no está definida.");
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const confirmed = args.includes("--confirm=DELETE");

  const report = await findOrphanMediaAssets();
  console.log(`Huérfanos: ${report.totals.count} (${(report.totals.bytes / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`  subidas PENDING > ${report.policy.pendingGraceHours} h: ${report.totals.byReason.stale_pending.count}`);
  console.log(`  READY sin referencias > ${report.policy.readyGraceHours} h: ${report.totals.byReason.unreferenced_ready.count}`);
  if (report.truncated) console.log(`  (el lote procesa ${report.policy.batchLimit} por ejecución)`);

  if (!apply) {
    console.log("Análisis solamente (dry run). Para borrar: --apply --confirm=DELETE");
    return;
  }
  if (!confirmed) throw new Error("Falta la confirmación: usa --apply --confirm=DELETE (solo después de revisar el análisis).");
  const result = await cleanupOrphanMediaAssets({ dryRun: false });
  console.log(`Borrados: ${result.deleted} · con referencias (omitidos): ${result.skippedReferenced} · fallidos: ${result.failed}${result.storageUnavailable ? " · almacenamiento NO configurado: no se borró nada" : ""}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Error desconocido");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
