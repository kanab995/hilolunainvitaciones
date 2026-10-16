import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, visibleText, NOW } from "../invitation/helpers";
import { documented } from "./fixtures";

const requireAdmin = vi.hoisted(() => vi.fn());
const services = vi.hoisted(() => ({ listAdminMusic: vi.fn(), getAdminMusicTrack: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }), redirect: vi.fn() }));
vi.mock("@/server/auth/admin", () => ({ requireAdmin }));
vi.mock("@/server/admin/music", () => services);
vi.mock("@/app/(site)/admin/music/actions", () => Object.fromEntries(["createMusicCategoryAction", "updateMusicCategoryAction", "createMusicTrackAction", "updateMusicTrackAction", "updateMusicLicenseAction", "verifyMusicLicenseAction", "setMusicTrackStatusAction", "requestMusicUploadAction", "finalizeMusicUploadAction"].map((name) => [name, vi.fn()])));
/** Radix pinta el diálogo en un portal (no existe al renderizar en servidor): contenedores planos. */
vi.mock("@/components/ui/dialog", () => {
  const box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return { Dialog: box, DialogTrigger: box, DialogContent: box, DialogHeader: box, DialogTitle: box, DialogDescription: box, DialogFooter: box, DialogClose: box };
});

import AdminMusicTrackPage from "@/app/(site)/admin/music/[id]/page";
import AdminMusicPage from "@/app/(site)/admin/music/page";
import { EditorProvider, type EditorContextValue } from "@/components/editor/editor-context";
import { MusicEditor } from "@/components/editor/section-editors/music-editor";
import { InvitationRenderer } from "@/components/invitation/invitation-renderer";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { invitationTemplates } from "@/lib/invitation/templates";
import { magnoliaTemplate } from "@/lib/invitation/templates/magnolia";
import type { ResolvedMusic } from "@/lib/music/resolve";
import { validateInvitation } from "@/lib/editor/validation";
import type { Invitation, MusicSettings } from "@/types/invitation";
import type { EditorMusicLibrary } from "@/types/music";

const music: ResolvedMusic = { kind: "audio", src: "https://media.hiloluna.com/library/music/trk_1-x.mp3", title: "Vals de luz", author: "Autora", volume: 0.6, loop: true, startOnOpen: true, preview: false };
const withMusic = (extra: Partial<ResolvedMusic> = {}) => renderToStaticMarkup(<InvitationRenderer invitation={andreaFernandoInvitation} template={magnoliaTemplate} now={NOW} music={{ ...music, ...extra }} />);

describe("reproductor público (móvil, carga ligera, sin terceros)", () => {
  it("un único <audio> con preload=none, sin autoplay, sin iframe; el botón es accesible (≥ 44 px) y dice qué suena", () => {
    const html = withMusic();
    expect(html.match(/<audio/g)).toHaveLength(1);
    expect(html).toMatch(/<audio[^>]*preload="none"/);
    expect(html).not.toMatch(/autoplay/i);
    expect(html).not.toMatch(/<iframe/);
    expect(html).toContain('src="https://media.hiloluna.com/library/music/trk_1-x.mp3"');
    expect(html).toMatch(/data-music-toggle[^>]*aria-pressed="false"/);
    expect(html).toContain("Reproducir música: «Vals de luz» de Autora");
    expect(html).toMatch(/data-music-toggle[^>]*class="[^"]*size-11/);
  });

  it("muestra el crédito solo cuando la licencia lo exige", () => {
    expect(withMusic()).not.toContain("data-music-credit");
    expect(visibleText(withMusic({ attribution: "Vals de luz — Autora (CC BY 4.0)" }))).toContain("Música: Vals de luz — Autora (CC BY 4.0)");
  });

  it("compatibilidad: sin música resuelta no hay reproductor ni audio (incluida la demo con enlace externo, en TODAS las plantillas)", () => {
    expect(andreaFernandoInvitation.music?.sourceType).toBe("external");
    for (const template of invitationTemplates) {
      const html = render(andreaFernandoInvitation, template);
      expect(html, template.slug).not.toMatch(/<audio|data-music-toggle|data-music-credit/);
    }
  });

  it("la vista previa del editor y la página pública usan EL MISMO renderizador y su música resuelta", () => {
    const surface = readFileSync(join(process.cwd(), "components/editor/preview-surface.tsx"), "utf8");
    expect(surface).toMatch(/music=\{resolvePreviewMusic\(invitation\.music\)\}/);
    const page = readFileSync(join(process.cwd(), "app/(invitation)/i/[slug]/page.tsx"), "utf8");
    expect(page).toMatch(/resolvePublicMusic\(record\.eventId, record\.invitation\.music\)/);
    // Las demostraciones no llevan música.
    expect(page).toMatch(/return demo \? \{ invitation: demo, personalization: undefined \} : undefined;/);
  });
});

const library = (over: Partial<EditorMusicLibrary> = {}): EditorMusicLibrary => ({
  allowed: true,
  categories: [
    { slug: "romantica", name: "Romántica" },
    { slug: "infantil", name: "Infantil" },
  ],
  tracks: [
    { id: "trk_1", title: "Vals de luz", author: "Autora", categorySlug: "romantica", durationSec: 185, audioUrl: "https://media.hiloluna.com/library/music/trk_1-x.mp3" },
    { id: "trk_2", title: "Brisa", author: "Autor", categorySlug: "romantica", durationSec: 200, audioUrl: "https://media.hiloluna.com/library/music/trk_2-x.mp3", attribution: "Brisa — Autor" },
  ],
  ...over,
});

function editor(draftMusic: MusicSettings | undefined, musicLibrary: EditorMusicLibrary) {
  const noop = () => undefined;
  const draft: Invitation = { ...andreaFernandoInvitation, music: draftMusic };
  const context = { draft, api: { updateInvitation: noop, updateSection: noop, lists: {} }, errors: validateInvitation(draft), template: magnoliaTemplate, images: {}, media: {}, selectRow: noop, musicLibrary } as unknown as EditorContextValue;
  return renderToStaticMarkup(
    <EditorProvider value={context}>
      <MusicEditor />
    </EditorProvider>,
  );
}

const selected = (id = "trk_1", over: Partial<MusicSettings> = {}): MusicSettings => ({ sourceType: "library", libraryTrackId: id, title: "Vals de luz", artist: "Autora", autoplayAfterInteraction: true, volume: 0.6, loop: true, ...over });

describe("biblioteca en el editor", () => {
  it("evento Gratis: la biblioteca aparece bloqueada con el aviso del plan; el enlace externo sigue disponible", () => {
    const html = editor(andreaFernandoInvitation.music, library({ allowed: false }));
    const radio = (value: string) => html.match(new RegExp(`<input[^>]*value="${value}"[^>]*>`))?.[0] ?? "";
    expect(radio("library")).toContain("disabled");
    expect(radio("external")).not.toContain("disabled");
    expect(visibleText(html)).toContain("Esencial y Premium");
    expect(visibleText(html)).toContain("La biblioteca musical está disponible en Esencial y Premium.");
  });

  it("sin pistas activas (hoy en producción): estado vacío honesto, nada que elegir", () => {
    const html = editor(selected("trk_x"), library({ tracks: [], selected: { id: "trk_x", available: false } }));
    expect(html).toContain("data-music-empty");
    expect(visibleText(html)).toContain("Estamos preparando la biblioteca");
    expect(html).not.toContain("data-track=");
  });

  it("con pistas: categorías con canciones, muestra accesible por pista, la elegida marcada y los dos interruptores", () => {
    const html = editor(selected(), library());
    const text = visibleText(html);
    expect(html.match(/data-track="/g)).toHaveLength(2);
    expect(text).toContain("Romántica");
    expect(text).not.toContain("Infantil");
    expect(html).toContain('aria-label="Escuchar una muestra de «Vals de luz»"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Elegida</);
    expect(text).toContain("Música activada");
    expect(text).toContain("Empezar al abrir la invitación");
    expect(text).toContain("3:05");
    // La muestra no se crea hasta pulsar: no hay <audio> en el HTML del editor.
    expect(html).not.toMatch(/<audio/);
  });

  it("si la canción elegida ya no está disponible, se avisa (sin borrarla)", () => {
    const html = editor(selected("trk_old", { title: "Antigua" }), library({ selected: { id: "trk_old", available: false } }));
    expect(visibleText(html)).toContain("Esta canción ya no está disponible");
    expect(visibleText(html)).toContain("Antigua");
  });

  it("muestra el crédito obligatorio de la pista elegida", () => {
    expect(visibleText(editor(selected("trk_2", { title: "Brisa" }), library()))).toContain("Brisa — Autor");
  });
});

const NOWD = new Date("2026-10-16T12:00:00Z");
const adminTrack = (over: Record<string, unknown> = {}) => ({
  ...documented(),
  id: "trk_1",
  title: "Vals de luz",
  author: "Autora",
  categoryId: "mcat_romantica",
  category: { id: "mcat_romantica", slug: "romantica", name: "Romántica", isActive: true },
  audioMimeType: "audio/mpeg",
  audioSizeBytes: 2_000_000,
  verifiedBy: { name: "Admin", email: "admin@example.com" },
  selectionCount: 0,
  createdAt: NOWD,
  updatedAt: NOWD,
  problems: [],
  audioUrl: "https://media.hiloluna.com/library/music/trk_1-x.mp3",
  ...over,
});

describe("consola: biblioteca musical", () => {
  beforeEach(() => {
    requireAdmin.mockReset().mockResolvedValue({ id: "usr_admin", email: "admin@example.com", name: "Admin", role: "ADMIN" });
  });

  it("el listado exige ADMIN y muestra la regla de derechos, el estado y los requisitos que faltan", async () => {
    services.listAdminMusic.mockResolvedValue({ categories: [{ id: "mcat_romantica", slug: "romantica", name: "Romántica", sortOrder: 10, isActive: true, trackCount: 1 }], tracks: [adminTrack({ status: "DRAFT", problems: ["audio", "verification"] })] });
    const html = renderToStaticMarkup(await AdminMusicPage());
    expect(requireAdmin).toHaveBeenCalledTimes(1);
    const text = visibleText(html);
    expect(text).toContain("ninguna pista se activa sin una licencia o autorización escrita");
    expect(text).toContain("Borrador");
    expect(text).toContain("Faltan 2 requisitos");
    expect(text).toContain("Romántica");
  });

  it("sin rol ADMIN no se carga nada", async () => {
    requireAdmin.mockRejectedValue(new Error("NEXT_NOT_FOUND"));
    await expect(AdminMusicPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(services.listAdminMusic).not.toHaveBeenCalledWith(expect.anything());
  });

  it("detalle: con requisitos pendientes no se puede activar y se listan; una pista activa bloquea licencia y audio", async () => {
    services.getAdminMusicTrack.mockResolvedValue({ track: adminTrack({ status: "DRAFT", problems: ["rightsCommercialUse"] }), categories: [] });
    const draft = renderToStaticMarkup(await AdminMusicTrackPage({ params: Promise.resolve({ id: "trk_1" }) } as PageProps<"/admin/music/[id]">));
    expect(visibleText(draft)).toContain("Confirmar el uso comercial");
    expect(draft).toMatch(/value="ACTIVE"[^>]*disabled=""|disabled=""[^>]*value="ACTIVE"/);

    services.getAdminMusicTrack.mockResolvedValue({ track: adminTrack({ status: "ACTIVE" }), categories: [] });
    const active = renderToStaticMarkup(await AdminMusicTrackPage({ params: Promise.resolve({ id: "trk_1" }) } as PageProps<"/admin/music/[id]">));
    expect(visibleText(active)).toContain("La pista está activa: para cambiar su documentación, desactívala primero");
    expect(active).toMatch(/<fieldset disabled=""/);
    expect(visibleText(active)).toContain("Para reemplazar el audio, desactiva primero la pista.");
    expect(visibleText(active)).toContain("Desactivar");
  });

  it("cada Server Action de música llama a requireAdmin() antes que nada", () => {
    const source = readFileSync(join(process.cwd(), "app/(site)/admin/music/actions.ts"), "utf8");
    const actions = source.replace(/\r\n/g, "\n").split("export async function ").slice(1);
    expect(actions.length).toBe(9);
    // La firma ocupa la primera línea; la primera instrucción del cuerpo es la comprobación de rol.
    for (const action of actions) expect(action.split("\n")[1]?.trim(), action.split("(")[0]).toBe("const admin = await requireAdmin();");
  });
});
