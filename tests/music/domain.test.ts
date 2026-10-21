import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { activationProblems, isTrackPlayable, licenseDocumentationProblems } from "@/lib/music/license";
import { formatDuration, looksLikeMp3, MUSIC_AUDIO } from "@/lib/music/limits";
import { createMusicPlayer, type AudioLike } from "@/lib/music/player";
import { resolveLibraryMusic, resolvePreviewMusic, type PlayableTrack } from "@/lib/music/resolve";
import { buildLibraryAudioKey, isLibraryAudioKeyFor, LIBRARY_AUDIO_KEY_PATTERN, MEDIA_KEY_PATTERN } from "@/server/storage/keys";
import type { MusicSettings } from "@/types/invitation";
import { documented } from "./fixtures";

const NOW = new Date("2026-10-16T12:00:00Z");


describe("derechos de una pista (regla del propietario: nada público sin documentación válida)", () => {
  it("una pista documentada, con audio y verificada se puede activar; solo suena estando ACTIVE", () => {
    expect(activationProblems(documented(), NOW)).toEqual([]);
    expect(isTrackPlayable(documented(), NOW)).toBe(false);
    expect(isTrackPlayable(documented({ status: "ACTIVE" }), NOW)).toBe(true);
    expect(isTrackPlayable(documented({ status: "DISABLED" }), NOW)).toBe(false);
  });

  it.each([
    ["audio", { audioKey: null }],
    ["audio", { durationSec: null }],
    ["licenseSource", { licenseSource: "  " }],
    ["licenseName", { licenseName: null }],
    ["licenseTerms", { licenseTerms: "" }],
    ["licenseEvidence", { licenseEvidenceRef: null }],
    ["licenseUrl", { licenseUrl: "http://inseguro.example/licencia" }],
    ["rightsHosting", { rightsHosting: false }],
    ["rightsPublicPerformance", { rightsPublicPerformance: false }],
    ["rightsCommercialUse", { rightsCommercialUse: false }],
    ["attribution", { attributionRequired: true, attributionText: null }],
    ["verification", { licenseVerifiedAt: null }],
    ["verification", { licenseVerifiedById: null }],
    ["expired", { licenseExpiresAt: new Date("2026-10-01T00:00:00Z") }],
  ] as const)("falta «%s» → no se puede activar ni sonar", (problem, over) => {
    const track = documented({ ...over, status: "ACTIVE" });
    expect(activationProblems(track, NOW)).toContain(problem);
    expect(isTrackPlayable(track, NOW)).toBe(false);
  });

  it("los TRES derechos son obligatorios por separado (alojamiento, reproducción pública, uso comercial)", () => {
    expect(activationProblems(documented({ rightsHosting: false, rightsPublicPerformance: false, rightsCommercialUse: false }), NOW)).toEqual(["rightsHosting", "rightsPublicPerformance", "rightsCommercialUse"]);
  });

  it("una URL https opcional es válida y una licencia que vence en el futuro sigue vigente", () => {
    expect(activationProblems(documented({ licenseUrl: "https://ejemplo.com/licencia", licenseExpiresAt: new Date("2030-01-01T00:00:00Z") }), NOW)).toEqual([]);
  });

  it("la documentación sola (sin audio ni verificación) es lo que se puede VERIFICAR", () => {
    expect(licenseDocumentationProblems(documented({ audioKey: null, licenseVerifiedAt: null }), NOW)).toEqual([]);
    expect(licenseDocumentationProblems(documented({ licenseEvidenceRef: null }), NOW)).toEqual(["licenseEvidence"]);
  });

  it("la migración repite la regla estructural como restricción CHECK en la base de datos", () => {
    const sql = readFileSync(join(process.cwd(), "prisma/migrations/20261016120000_add_music_library/migration.sql"), "utf8");
    expect(sql).toMatch(/CONSTRAINT "MusicTrack_active_requires_rights" CHECK/);
    for (const column of ["audioKey", "durationSec", "licenseSource", "licenseName", "licenseTerms", "licenseEvidenceRef", "rightsHosting", "rightsPublicPerformance", "rightsCommercialUse", "licenseVerifiedAt", "licenseVerifiedById", "attributionText"]) expect(sql).toContain(`"${column}"`);
  });
});

describe("migración de la biblioteca: segura y aditiva", () => {
  const sql = readFileSync(join(process.cwd(), "prisma/migrations/20261016120000_add_music_library/migration.sql"), "utf8");
  it("no borra, no reescribe datos y no cambia columnas existentes", () => {
    // (`ON DELETE RESTRICT` / `ON UPDATE CASCADE` de las claves foráneas no son escrituras.)
    expect(sql).not.toMatch(/\bDROP\b|\bDELETE\s+FROM\b|\bUPDATE\s+"|\bTRUNCATE\b|ALTER COLUMN|RENAME/i);
    expect(sql).toMatch(/ALTER TABLE "MusicSettings" ADD COLUMN\s+"isEnabled" BOOLEAN NOT NULL DEFAULT true/);
  });
  it("siembra las seis categorías aprobadas (idempotente) y NINGUNA pista", () => {
    for (const name of ["Romántica", "Instrumental", "Elegante", "Alegre", "Infantil", "Ambiental"]) expect(sql).toContain(`'${name}'`);
    expect(sql).toMatch(/ON CONFLICT \("slug"\) DO NOTHING/);
    expect(sql).not.toMatch(/INSERT INTO "MusicTrack"/);
  });
});

describe("audio: formato y claves de almacenamiento", () => {
  it("reconoce un MP3 por su firma (ID3 o trama MPEG) y rechaza otros archivos", () => {
    expect(looksLikeMp3(new Uint8Array([0x49, 0x44, 0x33, 0x04]))).toBe(true);
    expect(looksLikeMp3(new Uint8Array([0xff, 0xfb, 0x90, 0x64]))).toBe(true);
    expect(looksLikeMp3(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
    expect(looksLikeMp3(new Uint8Array([0x52, 0x49, 0x46, 0x46]))).toBe(false);
    expect(MUSIC_AUDIO.mimeType).toBe("audio/mpeg");
  });

  it("las claves de la biblioteca son propias de cada pista, aleatorias y fuera de las carpetas de clientes", () => {
    const key = buildLibraryAudioKey("trk_1");
    expect(key).toMatch(LIBRARY_AUDIO_KEY_PATTERN);
    expect(key).not.toMatch(MEDIA_KEY_PATTERN);
    expect(isLibraryAudioKeyFor(key, "trk_1")).toBe(true);
    expect(isLibraryAudioKeyFor(key, "trk_2")).toBe(false);
    expect(isLibraryAudioKeyFor("users/u/events/e/0123456789abcdef0123456789abcdef.png", "trk_1")).toBe(false);
    expect(buildLibraryAudioKey("trk_1")).not.toBe(key);
  });

  it("formatea la duración", () => {
    expect(formatDuration(185)).toBe("3:05");
    expect(formatDuration(null)).toBe("");
  });
});

const settings = (over: Partial<MusicSettings> = {}): MusicSettings => ({ sourceType: "library", libraryTrackId: "trk_1", title: "Vals de luz", artist: "Autora", autoplayAfterInteraction: true, volume: 0.6, loop: true, ...over });
const track: PlayableTrack = { id: "trk_1", title: "Vals de luz", author: "Autora", audioUrl: "https://media.hiloluna.com/library/music/trk_1-x.mp3" };

describe("qué suena en una invitación publicada", () => {
  it("biblioteca + plan con biblioteca + pista reproducible → audio con los ajustes del anfitrión", () => {
    expect(resolveLibraryMusic(settings(), track, true)).toEqual({ kind: "audio", src: track.audioUrl, title: "Vals de luz", author: "Autora", volume: 0.6, loop: true, startOnOpen: true, preview: false });
  });

  it("nada suena si: la música está apagada, el evento perdió el plan, la pista no es reproducible o es otra pista", () => {
    expect(resolveLibraryMusic(settings({ isEnabled: false }), track, true)).toBeUndefined();
    expect(resolveLibraryMusic(settings(), track, false)).toBeUndefined();
    expect(resolveLibraryMusic(settings(), undefined, true)).toBeUndefined();
    expect(resolveLibraryMusic(settings({ libraryTrackId: "trk_otra" }), track, true)).toBeUndefined();
  });

  it("un enlace externo (invitaciones anteriores) nunca suena: sin cambios respecto a antes de D-46", () => {
    expect(resolveLibraryMusic({ sourceType: "external", externalUrl: "https://open.spotify.com/x", title: "Canción", autoplayAfterInteraction: false, volume: 0.6, loop: true }, track, true)).toBeUndefined();
  });

  it("el crédito obligatorio viaja con el audio", () => {
    expect(resolveLibraryMusic(settings(), { ...track, attribution: "Música de Autora (CC BY 4.0)" }, true)?.attribution).toBe("Música de Autora (CC BY 4.0)");
  });

  it("vista previa del editor: usa la URL del borrador y nunca empieza sola", () => {
    expect(resolvePreviewMusic(settings({ trackUrl: track.audioUrl }))).toMatchObject({ src: track.audioUrl, preview: true });
    expect(resolvePreviewMusic(settings())).toBeUndefined();
    expect(resolvePreviewMusic(settings({ trackUrl: track.audioUrl, isEnabled: false }))).toBeUndefined();
  });
});

function fakeAudio(play: () => Promise<void> = () => Promise.resolve()) {
  const audio = { play: vi.fn(play), pause: vi.fn(), volume: 1, loop: false } satisfies AudioLike;
  return audio;
}

describe("reproductor (gesto, móvil y pestaña oculta)", () => {
  const options = { startOnOpen: true, preview: false, volume: 0.4, loop: true };

  it("la carga nunca reproduce; «Abrir invitación» reproduce DENTRO del gesto (síncrono, requisito de iOS)", () => {
    const audio = fakeAudio();
    const player = createMusicPlayer(audio, options);
    expect(audio.play).not.toHaveBeenCalled();
    expect(audio.loop).toBe(true);
    expect(audio.volume).toBe(0.4);
    player.onOpen();
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(player.state()).toBe("playing");
    player.onOpen();
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it("si el anfitrión no eligió empezar al abrir, solo suena con el botón", () => {
    const audio = fakeAudio();
    const player = createMusicPlayer(audio, { ...options, startOnOpen: false });
    player.onOpen();
    expect(audio.play).not.toHaveBeenCalled();
    player.toggle();
    expect(audio.play).toHaveBeenCalledTimes(1);
    player.toggle();
    expect(audio.pause).toHaveBeenCalledTimes(1);
    expect(player.state()).toBe("paused");
  });

  it("la vista previa del editor nunca empieza sola", () => {
    const audio = fakeAudio();
    createMusicPlayer(audio, { ...options, preview: true }).onOpen();
    expect(audio.play).not.toHaveBeenCalled();
  });

  it("si el navegador bloquea la reproducción queda «blocked» y un toque del invitado lo reintenta", async () => {
    let allow = false;
    const audio = fakeAudio(() => (allow ? Promise.resolve() : Promise.reject(new Error("NotAllowedError"))));
    const player = createMusicPlayer(audio, options);
    player.onOpen();
    await Promise.resolve();
    await Promise.resolve();
    expect(player.state()).toBe("blocked");
    allow = true;
    player.toggle();
    expect(audio.play).toHaveBeenCalledTimes(2);
    expect(player.state()).toBe("playing");
  });

  it("se pausa al ocultar la pestaña y solo se reanuda si la pausa la provocó la pestaña", () => {
    const audio = fakeAudio();
    const player = createMusicPlayer(audio, options);
    player.onOpen();
    player.onVisibilityChange(true);
    expect(player.state()).toBe("paused");
    player.onVisibilityChange(false);
    expect(player.state()).toBe("playing");
    player.toggle();
    player.onVisibilityChange(true);
    player.onVisibilityChange(false);
    expect(player.state()).toBe("paused");
  });

  it("avisa de cada cambio de estado (para pintar el botón)", () => {
    const player = createMusicPlayer(fakeAudio(), options);
    const states: string[] = [];
    const off = player.subscribe((state) => states.push(state));
    player.onOpen();
    player.toggle();
    off();
    player.toggle();
    expect(states).toEqual(["playing", "paused"]);
  });
});
