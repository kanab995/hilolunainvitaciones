import { describe, expect, it, vi } from "vitest";
import { applyDraftPayload, invitationToDraftPayload, parseDraftPayload, type DraftPayload } from "@/lib/editor/draft-payload";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { magnoliaTemplate } from "@/lib/invitation/templates/magnolia";
import { buildPublishedInvitationSnapshot, snapshotToInvitation } from "@/lib/publishing/snapshot";
import { dbMusicToDomain, domainInvitationToDb } from "@/server/mappers/invitation";
import type { OwnedEventResolution } from "@/server/auth/ownership";
import type { DraftBuild, SaveDraftOutcome } from "@/server/repositories/draft";
import type { MusicCategoryRow, MusicTrackRow } from "@/server/repositories/music";
import { saveInvitationDraft, type DraftServiceDeps } from "@/server/services/draft-service";
import { checkLibrarySelection, getEditorMusicLibrary, resolvePublicMusic, withPreviewTrackUrl, type MusicLibraryDeps } from "@/server/services/music-library";
import type { Invitation, MusicSettings } from "@/types/invitation";
import { documented } from "./fixtures";

const NOW = new Date("2026-10-16T12:00:00Z");
const category = { id: "mcat_romantica", slug: "romantica", name: "Romántica", isActive: true };

const row = (id: string, over: Partial<MusicTrackRow> = {}): MusicTrackRow => ({
  ...documented({ status: "ACTIVE", audioKey: `library/music/${id}-0123456789abcdef0123456789abcdef.mp3` }),
  id,
  title: `Pista ${id}`,
  author: "Autora",
  categoryId: category.id,
  category,
  audioMimeType: "audio/mpeg",
  audioSizeBytes: 2_000_000,
  verifiedBy: { name: "Admin", email: "admin@example.com" },
  selectionCount: 0,
  createdAt: NOW,
  updatedAt: NOW,
  ...over,
});

const categories: MusicCategoryRow[] = [
  { ...category, sortOrder: 10, trackCount: 2 },
  { id: "mcat_infantil", slug: "infantil", name: "Infantil", sortOrder: 50, isActive: false, trackCount: 0 },
];

function deps(over: Partial<MusicLibraryDeps> = {}, tracks: MusicTrackRow[] = [row("trk_1"), row("trk_draft", { status: "DRAFT" }), row("trk_old", { licenseExpiresAt: new Date("2026-01-01T00:00:00Z") })]): MusicLibraryDeps {
  return {
    listTracks: async () => tracks.filter((track) => track.status === "ACTIVE"),
    listCategories: async () => categories,
    findTrack: async (id) => tracks.find((track) => track.id === id),
    entitled: async () => true,
    urlFor: (key) => `https://media.hiloluna.com/${key}`,
    now: () => NOW,
    ...over,
  };
}

const library = (over: Partial<MusicSettings> = {}): MusicSettings => ({ sourceType: "library", libraryTrackId: "trk_1", title: "Pista trk_1", artist: "Autora", autoplayAfterInteraction: true, volume: 0.6, loop: true, ...over });

describe("biblioteca en el editor (solo pistas reproducibles, sin claves ni licencias)", () => {
  it("lista solo pistas ACTIVE con derechos vigentes y categorías visibles; nunca expone la clave de almacenamiento", async () => {
    const result = await getEditorMusicLibrary("evt_A", undefined, deps());
    expect(result.allowed).toBe(true);
    expect(result.tracks.map((track) => track.id)).toEqual(["trk_1"]);
    expect(result.categories).toEqual([{ slug: "romantica", name: "Romántica" }]);
    const json = JSON.stringify(result);
    expect(json).not.toContain("licenseEvidenceRef");
    expect(json).not.toContain("Contrato firmado");
    expect(result.tracks[0]?.audioUrl).toBe("https://media.hiloluna.com/library/music/trk_1-0123456789abcdef0123456789abcdef.mp3");
  });

  it("un evento Gratis ve la biblioteca pero no puede usarla (allowed = false)", async () => {
    expect((await getEditorMusicLibrary("evt_A", undefined, deps({ entitled: async () => false }))).allowed).toBe(false);
  });

  it("sin almacenamiento configurado no hay pistas (no se ofrece algo que no puede sonar)", async () => {
    expect((await getEditorMusicLibrary("evt_A", undefined, deps({ urlFor: () => undefined }))).tracks).toEqual([]);
  });

  it("la pista ya elegida que dejó de estar disponible se informa como no disponible (sin borrarla)", async () => {
    const result = await getEditorMusicLibrary("evt_A", library({ libraryTrackId: "trk_old" }), deps());
    expect(result.selected).toEqual({ id: "trk_old", available: false });
    const ok = await getEditorMusicLibrary("evt_A", library(), deps());
    expect(ok.selected).toMatchObject({ id: "trk_1", available: true });
    expect(withPreviewTrackUrl(library(), ok)?.trackUrl).toBe(ok.tracks[0]?.audioUrl);
    expect(withPreviewTrackUrl(library({ libraryTrackId: "trk_old" }), result)?.trackUrl).toBeUndefined();
  });

  it("elegir una pista exige plan con biblioteca y pista reproducible", async () => {
    expect(await checkLibrarySelection("evt_A", "trk_1", deps())).toEqual({ ok: true, track: { id: "trk_1", title: "Pista trk_1", author: "Autora" } });
    expect(await checkLibrarySelection("evt_A", "trk_1", deps({ entitled: async () => false }))).toEqual({ ok: false, code: "plan_required" });
    expect(await checkLibrarySelection("evt_A", "trk_draft", deps())).toEqual({ ok: false, code: "unavailable" });
    expect(await checkLibrarySelection("evt_A", "trk_old", deps())).toEqual({ ok: false, code: "unavailable" });
    expect(await checkLibrarySelection("evt_A", "no_existe", deps())).toEqual({ ok: false, code: "unavailable" });
  });
});

describe("invitación pública: lo que suena se resuelve en cada petición", () => {
  it("pista activa + plan → audio; DRAFT, desactivada, vencida, sin plan o apagada → silencio", async () => {
    expect(await resolvePublicMusic("evt_A", library(), deps())).toMatchObject({ kind: "audio", title: "Pista trk_1", startOnOpen: true, preview: false });
    expect(await resolvePublicMusic("evt_A", library({ libraryTrackId: "trk_draft" }), deps())).toBeUndefined();
    expect(await resolvePublicMusic("evt_A", library({ libraryTrackId: "trk_old" }), deps())).toBeUndefined();
    expect(await resolvePublicMusic("evt_A", library(), deps({ entitled: async () => false }))).toBeUndefined();
    expect(await resolvePublicMusic("evt_A", library({ isEnabled: false }), deps())).toBeUndefined();
    expect(await resolvePublicMusic("evt_A", library(), deps({}, [row("trk_1", { status: "DISABLED" })]))).toBeUndefined();
  });

  it("sin música o con enlace externo no consulta nada; un fallo de la base de datos deja la invitación sin música (no sin invitación)", async () => {
    const findTrack = vi.fn();
    expect(await resolvePublicMusic("evt_A", undefined, deps({ findTrack }))).toBeUndefined();
    expect(await resolvePublicMusic("evt_A", { sourceType: "external", externalUrl: "https://x.example", title: "x", autoplayAfterInteraction: false, volume: 1, loop: true }, deps({ findTrack }))).toBeUndefined();
    expect(findTrack).not.toHaveBeenCalled();
    expect(await resolvePublicMusic("evt_A", library(), deps({ findTrack: async () => Promise.reject(new Error("db")) }))).toBeUndefined();
  });
});

describe("persistencia de la selección", () => {
  const parse = (raw: unknown): DraftPayload => {
    const result = parseDraftPayload(raw);
    if (!result.ok) throw new Error(result.message);
    return result.value;
  };

  it("el payload lleva solo el id de la pista y los ajustes; nunca título, autor ni URL del audio", () => {
    const withMusic = { ...andreaFernandoInvitation, music: library({ trackUrl: "https://media.hiloluna.com/library/music/x.mp3" }) };
    const payload = invitationToDraftPayload(withMusic, 1);
    expect(payload.music).toEqual({ source: "library", libraryTrackId: "trk_1", isEnabled: true, autoplayAfterInteraction: true, volume: 0.6, loop: true });
    expect(JSON.stringify(payload)).not.toContain("media.hiloluna.com");
  });

  it("un cliente no puede colar título, autor ni URL de una pista: los pone el servidor desde la pista comprobada", () => {
    const dto = parse({ ...invitationToDraftPayload(andreaFernandoInvitation, 1), music: { source: "library", libraryTrackId: "trk_1", title: "FALSO", trackUrl: "https://evil.example/a.mp3", isEnabled: true } });
    const next = applyDraftPayload(andreaFernandoInvitation, dto, { id: "trk_1", title: "Pista trk_1", author: "Autora" });
    expect(next.music).toEqual({ sourceType: "library", libraryTrackId: "trk_1", title: "Pista trk_1", artist: "Autora", autoplayAfterInteraction: true, volume: 0.6, loop: true });
    // Sin pista comprobada, una pista NUEVA no se aplica.
    expect(applyDraftPayload(andreaFernandoInvitation, dto).music).toEqual(andreaFernandoInvitation.music);
  });

  it("apagar la música conserva la pista elegida; un id con forma inválida se rechaza", () => {
    const current = { ...andreaFernandoInvitation, music: library() };
    const off = applyDraftPayload(current, parse({ ...invitationToDraftPayload(current, 1), music: { source: "library", libraryTrackId: "trk_1", isEnabled: false, autoplayAfterInteraction: false } }));
    expect(off.music).toMatchObject({ libraryTrackId: "trk_1", isEnabled: false, autoplayAfterInteraction: false, title: "Pista trk_1" });
    expect(parseDraftPayload({ ...invitationToDraftPayload(current, 1), music: { source: "library", libraryTrackId: "../../x" } }).ok).toBe(false);
  });

  it("un payload sin `source` (clientes anteriores) sigue siendo un enlace externo", () => {
    const dto = parse({ ...invitationToDraftPayload(andreaFernandoInvitation, 1), music: { externalUrl: "https://open.spotify.com/track/x", title: "Canción", volume: 0.6, loop: true } });
    expect(dto.music).toMatchObject({ source: "external", autoplayAfterInteraction: false });
  });

  it("la base de datos nunca guarda la URL del audio de la biblioteca y conserva el interruptor", () => {
    const written = domainInvitationToDb({ ...andreaFernandoInvitation, music: library({ trackUrl: "https://media.hiloluna.com/x.mp3", isEnabled: false }) });
    expect(written.music).toMatchObject({ sourceType: "LIBRARY", trackUrl: null, libraryTrackId: "trk_1", isEnabled: false });
    const roundTrip = dbMusicToDomain({ sourceType: "LIBRARY", trackUrl: null, externalUrl: null, title: "Pista", artist: null, autoplayAfterInteraction: true, volume: 0.6, loop: true, libraryTrackId: "trk_1", uploadAssetId: null, isEnabled: true });
    expect(roundTrip).toEqual({ sourceType: "library", title: "Pista", autoplayAfterInteraction: true, volume: 0.6, loop: true, libraryTrackId: "trk_1" });
  });

  it("compatibilidad: una fila anterior a D-46 (enlace externo, sin `isEnabled`) se lee exactamente igual que antes", () => {
    expect(dbMusicToDomain({ sourceType: "EXTERNAL", trackUrl: null, externalUrl: "https://youtu.be/x", title: "Canción", artist: "Artista", autoplayAfterInteraction: true, volume: 0.6, loop: true, libraryTrackId: null, uploadAssetId: null })).toEqual({ sourceType: "external", externalUrl: "https://youtu.be/x", title: "Canción", artist: "Artista", autoplayAfterInteraction: false, volume: 0.6, loop: true });
  });

  it("el snapshot publicado guarda la pista por id, NUNCA la URL del audio (se resuelve al mostrar)", () => {
    const invitation = { ...andreaFernandoInvitation, music: library({ trackUrl: "https://media.hiloluna.com/x.mp3" }) };
    const { snapshot } = buildPublishedInvitationSnapshot({ invitation, template: magnoliaTemplate, assets: new Map(), version: 1, publishedAt: NOW });
    expect(snapshot.music).toMatchObject({ sourceType: "library", libraryTrackId: "trk_1" });
    expect(JSON.stringify(snapshot)).not.toContain("media.hiloluna.com/x.mp3");
    expect(snapshotToInvitation(snapshot, () => undefined).music?.libraryTrackId).toBe("trk_1");
  });
});

describe("guardar el borrador con una pista de la biblioteca", () => {
  const ok: OwnedEventResolution = { status: "ok", user: { id: "usr_A", email: "a@example.com", name: "A" }, event: { id: "evt_A", slug: "sofia-diego", title: "Sofía & Diego", type: "wedding", status: "draft", startsAt: "2027-05-17T23:00:00Z", timezone: "America/Mexico_City" } } as OwnedEventResolution;

  function world(current: Invitation, check: DraftServiceDeps["checkLibraryTrack"]) {
    let saved: Invitation | undefined;
    const deps: DraftServiceDeps = {
      resolveOwnedEvent: async () => ok,
      save: async (_u, _e, base, build: DraftBuild): Promise<SaveDraftOutcome> => {
        const built = build(current, "WEDDING");
        if (!built.ok) return { ok: false, code: "invalid", message: built.message };
        saved = built.invitation;
        return { ok: true, revision: base + 1, releasedMediaIds: [] };
      },
      release: async () => undefined,
      canSelectTemplate: () => true,
      templatePlanAllowed: async () => true,
      checkLibraryTrack: check,
    };
    return { deps, saved: () => saved };
  }

  const payload = (invitation: Invitation, music: unknown) => ({ ...invitationToDraftPayload(invitation, 3), music });

  it("elegir una pista NUEVA se guarda con el título y autor del servidor", async () => {
    const { deps, saved } = world(andreaFernandoInvitation, async () => ({ ok: true, track: { id: "trk_1", title: "Pista trk_1", author: "Autora" } }));
    const result = await saveInvitationDraft("evt_A", payload(andreaFernandoInvitation, { source: "library", libraryTrackId: "trk_1", isEnabled: true, autoplayAfterInteraction: true }), deps);
    expect(result).toEqual({ ok: true, revision: 4 });
    expect(saved()?.music).toMatchObject({ sourceType: "library", libraryTrackId: "trk_1", title: "Pista trk_1", artist: "Autora" });
  });

  it("un evento Gratis no puede elegir una pista (mensaje del plan) y una pista no disponible se rechaza", async () => {
    const free = world(andreaFernandoInvitation, async () => ({ ok: false, code: "plan_required" }));
    expect(await saveInvitationDraft("evt_A", payload(andreaFernandoInvitation, { source: "library", libraryTrackId: "trk_1" }), free.deps)).toMatchObject({ ok: false, code: "invalid", message: "La biblioteca musical está disponible en Esencial y Premium." });
    expect(free.saved()).toBeUndefined();
    const gone = world(andreaFernandoInvitation, async () => ({ ok: false, code: "unavailable" }));
    expect(await saveInvitationDraft("evt_A", payload(andreaFernandoInvitation, { source: "library", libraryTrackId: "trk_x" }), gone.deps)).toMatchObject({ ok: false, message: expect.stringMatching(/ya no está disponible/) });
  });

  it("conservar la MISMA pista nunca bloquea: un evento que perdió su plan sigue editando todo lo demás (nada se borra)", async () => {
    const current = { ...andreaFernandoInvitation, music: library() };
    const { deps, saved } = world(current, async () => ({ ok: false, code: "plan_required" }));
    const result = await saveInvitationDraft("evt_A", { ...invitationToDraftPayload(current, 3), names: ["Ana", "Luis"] }, deps);
    expect(result.ok).toBe(true);
    expect(saved()?.music).toEqual(current.music);
    expect(saved()?.names).toEqual(["Ana", "Luis"]);
  });

  it("guardar sin música de biblioteca no consulta la biblioteca", async () => {
    const check = vi.fn();
    const { deps } = world(andreaFernandoInvitation, check);
    await saveInvitationDraft("evt_A", invitationToDraftPayload(andreaFernandoInvitation, 3), deps);
    expect(check).not.toHaveBeenCalled();
  });
});
