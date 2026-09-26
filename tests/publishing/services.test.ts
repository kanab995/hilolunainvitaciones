import { describe, expect, it, vi } from "vitest";
import { invitationToDraftPayload } from "@/lib/editor/draft-payload";
import { createDefaultInvitationData } from "@/lib/events/default-invitation";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { magnoliaTemplate } from "@/lib/invitation/templates/magnolia";
import type { OwnedEventResolution } from "@/server/auth/ownership";
import { StoreUnavailableError } from "@/server/db/errors";
import type { DraftBuild, SaveDraftOutcome } from "@/server/repositories/draft";
import type { PublishBuild, PublishOutcome, PublishContext } from "@/server/repositories/publishing";
import { saveInvitationDraft, type DraftServiceDeps } from "@/server/services/draft-service";
import { publishOwnedEvent } from "@/server/services/publish-core";
import { publishInvitationForOwner, type PublishServiceDeps } from "@/server/services/publish-service";
import type { Invitation } from "@/types/invitation";

const fresh = (): Invitation => createDefaultInvitationData({ eventType: "wedding", templateSlug: "magnolia", names: ["Sofía", "Diego"], startsAtIso: "2027-05-17T17:00:00-06:00", timezone: "America/Mexico_City", invitationSlug: "sofia-y-diego" });

/** Mundo de prueba: A es dueña de `evt_A`; para B ese evento no existe. La «BD» es un doble que captura lo que recibe. */
const owner = (session: "usr_A" | "usr_B" | null) =>
  vi.fn(async (ref: string): Promise<OwnedEventResolution> => {
    if (!session) return { status: "unauthenticated" };
    return ref === "evt_A" && session === "usr_A" ? { status: "ok", user: { id: "usr_A", email: "a@example.com", name: "A" }, event: { id: "evt_A", slug: "sofia-diego", title: "Sofía & Diego", type: "wedding", status: "draft", startsAt: "2027-05-17T23:00:00Z", timezone: "America/Mexico_City" } } : { status: "not_found" };
  });

function draftWorld(session: "usr_A" | "usr_B" | null = "usr_A", outcome?: (build: DraftBuild) => SaveDraftOutcome | Promise<SaveDraftOutcome>) {
  const calls: { userId: string; eventId: string; base: number }[] = [];
  const release = vi.fn(async () => undefined);
  const deps: DraftServiceDeps = {
    resolveOwnedEvent: owner(session),
    save: async (userId, eventId, base, build) => {
      calls.push({ userId, eventId, base });
      return outcome ? outcome(build) : { ok: true, revision: base + 1, releasedMediaIds: [] };
    },
    release,
    canSelectTemplate: (slug) => slug === "magnolia",
    templatePlanAllowed: async () => true,
  };
  return { deps, calls, release };
}
const payload = (over: Record<string, unknown> = {}) => ({ ...invitationToDraftPayload(fresh(), 5), ...over });

describe("saveInvitationDraft: propiedad, lista blanca y errores", () => {
  it("(70.1) guarda con la revisión base del cliente y devuelve la nueva", async () => {
    const { deps, calls } = draftWorld();
    expect(await saveInvitationDraft("evt_A", payload(), deps)).toEqual({ ok: true, revision: 6 });
    expect(calls).toEqual([{ userId: "usr_A", eventId: "evt_A", base: 5 }]);
  });

  it("(70.9) el usuario B no puede guardar el evento de A: no se llega a escribir nada", async () => {
    const { deps, calls } = draftWorld("usr_B");
    expect(await saveInvitationDraft("evt_A", payload(), deps)).toMatchObject({ ok: false, code: "not_found" });
    expect(calls).toHaveLength(0);
  });

  it("sin sesión no se guarda nada", async () => {
    const { deps, calls } = draftWorld(null);
    expect(await saveInvitationDraft("evt_A", payload(), deps)).toMatchObject({ ok: false, code: "unauthenticated" });
    expect(calls).toHaveLength(0);
  });

  it("(70.10) el payload no puede cambiar ownerId: el propietario y el evento salen de la sesión, no del cliente", async () => {
    const { deps, calls } = draftWorld();
    await saveInvitationDraft("evt_A", payload({ ownerId: "usr_B", userId: "usr_B", eventId: "evt_B", invitationId: "inv_B", event: { startsAt: "2027-05-17T17:00:00-06:00", timezone: "America/Mexico_City", ownerId: "usr_B" } }), deps);
    expect(calls[0]).toMatchObject({ userId: "usr_A", eventId: "evt_A" });
    expect(JSON.stringify(calls)).not.toContain("usr_B");
  });

  it("(8) un guardado sobre una revisión vieja se RECHAZA con un mensaje claro (nunca pisa en silencio)", async () => {
    const { deps } = draftWorld("usr_A", () => ({ ok: false, code: "conflict", revision: 9 }));
    expect(await saveInvitationDraft("evt_A", payload(), deps)).toEqual({ ok: false, code: "conflict", message: "Este evento se modificó en otra ventana. Recarga el editor para ver la última versión.", revision: 9 });
  });

  it("valida con las reglas del editor: un nombre vacío no se guarda", async () => {
    const { deps } = draftWorld("usr_A", (build) => {
      const built = build(fresh(), "WEDDING");
      return built.ok ? { ok: true, revision: 6, releasedMediaIds: [] } : { ok: false, code: "invalid", message: built.message };
    });
    expect(await saveInvitationDraft("evt_A", payload({ names: ["", ""] }), deps)).toMatchObject({ ok: false, code: "invalid" });
  });

  it("una plantilla no seleccionable se rechaza antes de escribir", async () => {
    const { deps } = draftWorld("usr_A", (build) => {
      const built = build(fresh(), "WEDDING");
      return built.ok ? { ok: true, revision: 6, releasedMediaIds: [] } : { ok: false, code: "invalid", message: built.message };
    });
    expect(await saveInvitationDraft("evt_A", payload({ templateSlug: "ivory" }), deps)).toMatchObject({ ok: false, code: "invalid", message: expect.stringContaining("plantilla") });
  });

  it("los archivos de una sede eliminada se liberan solo tras guardar", async () => {
    const { deps, release } = draftWorld("usr_A", () => ({ ok: true, revision: 6, releasedMediaIds: ["ast_1"] }));
    await saveInvitationDraft("evt_A", payload(), deps);
    expect(release).toHaveBeenCalledWith("usr_A", "evt_A", ["ast_1"]);
  });

  it("un payload basura, un fallo de la base de datos o la falta de BD dan resultados seguros", async () => {
    const { deps } = draftWorld();
    expect(await saveInvitationDraft("evt_A", "no es un objeto", deps)).toMatchObject({ ok: false, code: "invalid" });
    const boom = draftWorld("usr_A", () => {
      throw new Error("password authentication failed for user hilo at db.internal:5432");
    });
    const failed = await saveInvitationDraft("evt_A", payload(), boom.deps);
    expect(failed).toMatchObject({ ok: false, code: "error" });
    expect(JSON.stringify(failed)).not.toMatch(/password|hilo|5432|internal/);
    const none = draftWorld("usr_A", () => {
      throw new StoreUnavailableError();
    });
    expect(await saveInvitationDraft("evt_A", payload(), none.deps)).toMatchObject({ ok: false, code: "unavailable" });
  });
});

/* ───────── publicación ───────── */

function publishWorld(session: "usr_A" | "usr_B" | null = "usr_A", outcome?: PublishOutcome | ((build: PublishBuild) => PublishOutcome)) {
  const calls: { userId: string; eventId: string; expected: number | undefined }[] = [];
  const release = vi.fn(async () => undefined);
  const deps: PublishServiceDeps = {
    resolveOwnedEvent: owner(session),
    publish: async (userId, eventId, expected, build) => {
      calls.push({ userId, eventId, expected });
      return typeof outcome === "function" ? outcome(build) : (outcome ?? { ok: true, version: 1, alreadyPublished: false, slug: "sofia-y-diego", previousMediaIds: [], mediaAssetIds: [], revision: 5 });
    },
    templateConfig: (slug) => (slug === "magnolia" ? magnoliaTemplate : undefined),
    release,
    getMeta: async () => undefined,
    canUseEventFeature: async () => true,
  };
  return { deps, calls, release };
}

describe("publishInvitationForOwner", () => {
  it("(71.2) el propietario publica y la acción recibe el slug para revalidar /i/[slug]", async () => {
    const { deps, calls } = publishWorld();
    const { result, revalidate } = await publishInvitationForOwner("evt_A", { expectedRevision: 5 }, deps);
    expect(result).toMatchObject({ ok: true, version: 1, alreadyPublished: false, publication: { state: "published", version: 1 } });
    expect(revalidate).toEqual({ eventId: "evt_A", slug: "sofia-y-diego" });
    expect(calls).toEqual([{ userId: "usr_A", eventId: "evt_A", expected: 5 }]);
  });

  it("(71.3/51) el usuario B no puede publicar el evento de A ni sin sesión", async () => {
    for (const session of ["usr_B", null] as const) {
      const { deps, calls } = publishWorld(session);
      const { result } = await publishInvitationForOwner("evt_A", {}, deps);
      expect(result).toMatchObject({ ok: false });
      expect(calls).toHaveLength(0);
    }
  });

  it("(56) una doble publicación (mismo borrador ya publicado) no revalida ni crea versión nueva", async () => {
    const { deps } = publishWorld("usr_A", { ok: true, version: 3, alreadyPublished: true, slug: "s", previousMediaIds: [], mediaAssetIds: [], revision: 7 });
    const { result, revalidate } = await publishInvitationForOwner("evt_A", {}, deps);
    expect(result).toMatchObject({ ok: true, version: 3, alreadyPublished: true });
    expect(revalidate).toBeUndefined();
  });

  it("(57) un fallo de publicación es humano, no filtra detalles y no marca nada como publicado", async () => {
    const boom = publishWorld("usr_A", () => {
      throw new Error("relation InvitationPublication does not exist at 127.0.0.1");
    });
    const { result, revalidate } = await publishInvitationForOwner("evt_A", {}, boom.deps);
    expect(result).toMatchObject({ ok: false, code: "error", message: expect.stringContaining("borrador sigue intacto") });
    expect(JSON.stringify(result)).not.toMatch(/relation|127\.0\.0\.1/);
    expect(revalidate).toBeUndefined();
  });

  it("(8) una revisión desactualizada del cliente se rechaza como conflicto", async () => {
    const { deps } = publishWorld("usr_A", { ok: false, code: "conflict", revision: 9 });
    expect((await publishInvitationForOwner("evt_A", { expectedRevision: 5 }, deps)).result).toMatchObject({ ok: false, code: "conflict", revision: 9 });
  });

  it("(72.3) los archivos que la versión nueva ya no usa se liberan (borrado físico solo si nada más los referencia)", async () => {
    const { deps, release } = publishWorld("usr_A", { ok: true, version: 2, alreadyPublished: false, slug: "s", previousMediaIds: ["ast_old"], mediaAssetIds: [], revision: 8 });
    await publishInvitationForOwner("evt_A", {}, deps);
    expect(release).toHaveBeenCalledWith("usr_A", "evt_A", ["ast_old"]);
  });
});

describe("publishOwnedEvent (núcleo): validación y snapshot", () => {
  const context = (invitation: Invitation, over: Partial<PublishContext> = {}): PublishContext => ({ invitation, assets: new Map(), templateOk: true, version: 2, publishedAt: new Date("2026-09-26T12:00:00Z"), ...over });
  const run = (invitation: Invitation, over: Partial<PublishContext> = {}) => {
    let result: ReturnType<PublishBuild> | undefined;
    return publishOwnedEvent("usr_A", "evt_A", undefined, {
      publish: async (_u, _e, _x, build) => {
        result = build(context(invitation, over));
        return { ok: true, version: 2, alreadyPublished: false, slug: "s", previousMediaIds: [], mediaAssetIds: [], revision: 1 };
      },
      templateConfig: (slug) => (slug === "magnolia" ? magnoliaTemplate : undefined),
    }).then(() => result!);
  };

  it("(71.4/8) construye el snapshot con la versión que le da el repositorio", async () => {
    const built = await run(andreaFernandoInvitation);
    expect(built.ok && built.snapshot).toMatchObject({ version: 2, slug: "andrea-y-fernando", template: { slug: "magnolia" } });
  });

  it("(71.9) un borrador con todo lo opcional vacío se puede publicar", async () => {
    const built = await run({ ...fresh(), gallery: [], timeline: [], giftRegistry: undefined, music: undefined });
    expect(built.ok).toBe(true);
  });

  it("(71.10) datos críticos inválidos bloquean la publicación con mensajes claros", async () => {
    const noNames = await run({ ...fresh(), names: ["", ""] });
    expect(noNames).toMatchObject({ ok: false, message: "Escribe al menos un nombre en la portada." });
    const noTemplate = await run(fresh(), { templateOk: false });
    expect(noTemplate).toMatchObject({ ok: false, message: expect.stringContaining("plantilla") });
    const unknownEngine = await run({ ...fresh(), templateSlug: "no-existe" });
    expect(unknownEngine.ok).toBe(false);
  });
});
