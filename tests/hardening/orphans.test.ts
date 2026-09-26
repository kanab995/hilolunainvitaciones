import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { cleanupOrphanMediaAssets, findOrphanMediaAssets, ORPHAN_POLICY, type MediaCleanupDeps } from "@/server/services/media-cleanup";
import type { OrphanCandidate } from "@/server/repositories/media-orphans";
import { FakeStorageProvider } from "../helpers/media-world";

const NOW = new Date("2027-01-10T12:00:00Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);

const candidate = (over: Partial<OrphanCandidate> = {}): OrphanCandidate => ({ id: "ast_1", storageKey: "users/u/events/e/a.jpg", sizeBytes: 1000, status: "READY", reason: "unreferenced_ready", createdAt: hoursAgo(48), ...over });

function world(candidates: OrphanCandidate[], referenced: Record<string, number> = {}) {
  const storage = new FakeStorageProvider();
  for (const item of candidates) storage.objects.set(item.storageKey, new Uint8Array(item.sizeBytes));
  const marked: string[] = [];
  const listCandidates = vi.fn(async (_cutoffs: { pending: Date; ready: Date }, limit: number) => candidates.slice(0, limit));
  const deps: MediaCleanupDeps = {
    listCandidates,
    summarize: vi.fn(async () => ({
      count: candidates.length,
      bytes: candidates.reduce((sum, item) => sum + item.sizeBytes, 0),
      byReason: {
        stale_pending: { count: candidates.filter((item) => item.reason === "stale_pending").length, bytes: 0 },
        unreferenced_ready: { count: candidates.filter((item) => item.reason === "unreferenced_ready").length, bytes: 0 },
      },
    })),
    countReferences: vi.fn(async (id: string) => referenced[id] ?? 0),
    markDeleted: vi.fn(async (id: string) => void marked.push(id)),
    storage: () => storage,
    now: () => NOW,
  };
  return { deps, storage, marked, listCandidates };
}

describe("(15/16) política de huérfanos", () => {
  it("umbrales: 24 h para PENDING y para READY sin referencias; los cortes se calculan con la hora del servidor", async () => {
    expect(ORPHAN_POLICY.pendingGraceHours).toBe(24);
    expect(ORPHAN_POLICY.readyGraceHours).toBe(24);
    const { deps, listCandidates } = world([]);
    await findOrphanMediaAssets(deps);
    expect(listCandidates.mock.calls[0]?.[0]).toEqual({ pending: hoursAgo(24), ready: hoursAgo(24) });
  });

  it("la definición SQL protege lo publicado y lo del borrador: excluye archivos con portada, galería, sedes o publicación VIGENTE", () => {
    const sql = readFileSync(join(process.cwd(), "server/repositories/media-orphans.ts"), "utf8");
    for (const table of ["Invitation", "GalleryImage", "Location", "InvitationPublication"]) expect(sql).toContain(`FROM "${table}"`);
    expect(sql).toMatch(/p\."isCurrent" AND m\."id" = ANY\(p\."mediaAssetIds"\)/);
    expect(sql).toMatch(/m\."status" = 'PENDING' AND m\."createdAt" </);
    expect(sql).toMatch(/m\."status" = 'READY' AND m\."createdAt" </);
    // Nunca DELETED (constancia) y nunca SQL de escritura.
    expect(sql.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/\b(DELETE|UPDATE|INSERT|DROP)\b/);
  });
});

describe("(15) findOrphanMediaAssets: solo lee", () => {
  it("devuelve totales y una muestra SIN claves de almacenamiento; marca si hay más que un lote", async () => {
    const items = Array.from({ length: 3 }, (_, index) => candidate({ id: `ast_${index}`, storageKey: `users/u/e/${index}.jpg` }));
    const { deps, storage, marked } = world(items);
    const report = await findOrphanMediaAssets(deps);
    expect(report.totals).toMatchObject({ count: 3, bytes: 3000 });
    expect(report.sample).toHaveLength(3);
    expect(JSON.stringify(report)).not.toContain("users/u/e");
    expect(report.truncated).toBe(false);
    expect(storage.deleted).toEqual([]);
    expect(marked).toEqual([]);
  });
});

describe("(15/17) cleanupOrphanMediaAssets: dryRun por defecto y comprobación final de referencias", () => {
  it("por DEFECTO es dry run: informa y no toca el almacenamiento ni los registros", async () => {
    const { deps, storage, marked } = world([candidate(), candidate({ id: "ast_2", storageKey: "k2", sizeBytes: 500, reason: "stale_pending", status: "PENDING" })]);
    const report = await cleanupOrphanMediaAssets(undefined, deps);
    expect(report).toMatchObject({ dryRun: true, considered: 2, bytesConsidered: 1500, deleted: 0 });
    expect(storage.deleted).toEqual([]);
    expect(marked).toEqual([]);
    expect((await cleanupOrphanMediaAssets({}, deps)).dryRun).toBe(true);
  });

  it("con dryRun:false borra el objeto y solo entonces marca DELETED; un archivo con referencias (p. ej. publicado) NO se toca", async () => {
    const { deps, storage, marked } = world([candidate({ id: "ast_a", storageKey: "ka" }), candidate({ id: "ast_publicado", storageKey: "kp" })], { ast_publicado: 1 });
    const report = await cleanupOrphanMediaAssets({ dryRun: false }, deps);
    expect(report).toMatchObject({ dryRun: false, deleted: 1, skippedReferenced: 1, failed: 0 });
    expect(storage.deleted).toEqual(["ka"]);
    expect(marked).toEqual(["ast_a"]);
    expect(storage.objects.has("kp")).toBe(true);
  });

  it("si borrar el objeto falla, el registro NO se marca DELETED y la limpieza continúa con el resto", async () => {
    const { deps, storage, marked } = world([candidate({ id: "ast_1", storageKey: "k1" }), candidate({ id: "ast_2", storageKey: "k2" })]);
    const original = storage.delete.bind(storage);
    storage.delete = async (key: string) => {
      if (key === "k1") throw new Error("R2 caído (bucket secreto)");
      return original(key);
    };
    const report = await cleanupOrphanMediaAssets({ dryRun: false }, deps);
    expect(report).toMatchObject({ deleted: 1, failed: 1 });
    expect(marked).toEqual(["ast_2"]);
  });

  it("sin almacenamiento configurado no borra nada y lo indica", async () => {
    const { deps, marked } = world([candidate()]);
    const report = await cleanupOrphanMediaAssets({ dryRun: false }, { ...deps, storage: () => undefined });
    expect(report).toMatchObject({ storageUnavailable: true, deleted: 0 });
    expect(marked).toEqual([]);
  });

  it("la comprobación de referencias usa la misma consulta que protege a la publicación vigente (countReferences)", () => {
    const repo = readFileSync(join(process.cwd(), "server/repositories/media.ts"), "utf8");
    expect(repo).toMatch(/invitationPublication\.count\(\{ where: \{ isCurrent: true, mediaAssetIds: \{ has: assetId \} \} \}\)/);
  });
});

describe("(17) la consola solo ANALIZA: no hay botón ni acción destructiva", () => {
  it("la acción de la consola solo llama a findOrphanMediaAssets; el borrado es una herramienta manual con confirmación fuerte", () => {
    const action = readFileSync(join(process.cwd(), "app/(site)/admin/actions.ts"), "utf8");
    expect(action).toMatch(/findOrphanMediaAssets/);
    expect(action).not.toMatch(/cleanupOrphanMediaAssets|dryRun|delete/i);
    const script = readFileSync(join(process.cwd(), "scripts/media-orphans.ts"), "utf8");
    expect(script).toMatch(/--apply/);
    expect(script).toMatch(/--confirm=DELETE/);
    expect(script).toMatch(/findOrphanMediaAssets\(\);[\s\S]*cleanupOrphanMediaAssets\(\{ dryRun: false \}\)/);
    expect(JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")).scripts["media:orphans"]).toMatch(/scripts\/media-orphans\.ts/);
  });
});
