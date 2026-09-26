import { describe, expect, it } from "vitest";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { magnoliaTemplate } from "@/lib/invitation/templates/magnolia";
import { ivoryTemplate } from "@/lib/invitation/templates/ivory";
import { publicationLabels, publishActionLabel, derivePublicationState, toPublicationInfo } from "@/lib/publishing/state";
import { buildPublishedInvitationSnapshot, isPublishedInvitation, snapshotToInvitation, templateVersionId, type PublishAsset } from "@/lib/publishing/snapshot";
import { validatePublishable } from "@/lib/publishing/validate";
import type { Invitation } from "@/types/invitation";
import { render, visibleText } from "../invitation/helpers";

const AT = new Date("2026-09-26T12:00:00Z");
const base = (): Invitation => ({
  ...andreaFernandoInvitation,
  cover: { ...andreaFernandoInvitation.cover, photo: { src: "https://media.test/c.webp", alt: "Portada", mediaAssetId: "ast_cover", width: 1, height: 1 } },
  locations: andreaFernandoInvitation.locations.map((location, index) => (index === 0 ? { ...location, photo: { src: "blob:http://x/y", alt: "local" } } : location)),
  gallery: [...andreaFernandoInvitation.gallery, { id: "gal_own", src: "https://media.test/g.webp", alt: "Propia", mediaAssetId: "ast_gal" }, { id: "gal_gone", src: "https://media.test/z.webp", alt: "Sin archivo", mediaAssetId: "ast_gone" }],
});
const assets = new Map<string, PublishAsset>([
  ["ast_cover", { storageKey: "users/u/events/e/cover.webp", width: 1600, height: 900 }],
  ["ast_gal", { storageKey: "users/u/events/e/gal.webp", width: 800, height: 600 }],
]);
const build = (invitation = base(), template = magnoliaTemplate, version = 1) => buildPublishedInvitationSnapshot({ invitation, template, assets, version, publishedAt: AT });
const mediaUrl = (key: string) => `https://media.test/${key}`;

describe("buildPublishedInvitationSnapshot (función pura)", () => {
  it("captura el contenido, las secciones, el orden y la versión, sin leer nada de la base de datos", () => {
    const { snapshot } = build();
    expect(snapshot).toMatchObject({ schemaVersion: 1, version: 1, publishedAt: AT.toISOString(), slug: "andrea-y-fernando", names: ["Andrea", "Fernando"], eventType: "wedding" });
    expect(snapshot.event).toEqual(andreaFernandoInvitation.event);
    expect(snapshot.sections.map((section) => section.type)).toEqual(andreaFernandoInvitation.sections.map((section) => section.type));
    expect(snapshot.locations).toHaveLength(2);
    expect(snapshot.timeline).toHaveLength(5);
    expect(snapshot.giftRegistry?.entries).toHaveLength(2);
    expect(snapshot.music?.title).toBe("Perfect");
    expect(snapshot.rsvp.maxCompanions).toBe(3);
  });

  it("(72.1) conserva las referencias a archivos por su clave (no por URL) y devuelve los ids usados", () => {
    const { snapshot, mediaAssetIds } = build();
    expect(snapshot.cover.photo).toEqual({ kind: "asset", mediaAssetId: "ast_cover", storageKey: "users/u/events/e/cover.webp", alt: "Portada", width: 1600, height: 900 });
    expect(snapshot.gallery.at(-1)?.image).toMatchObject({ kind: "asset", storageKey: "users/u/events/e/gal.webp" });
    expect(mediaAssetIds.sort()).toEqual(["ast_cover", "ast_gal"]);
    expect(JSON.stringify(snapshot)).not.toContain("https://media.test");
  });

  it("los assets estáticos de la plantilla siguen como rutas; un blob:, una URL externa o un archivo no disponible NO se publican", () => {
    const { snapshot } = build();
    expect(snapshot.locations[0]?.photo).toBeUndefined(); // blob: descartado
    expect(snapshot.locations[1]?.photo).toMatchObject({ kind: "static", src: expect.stringMatching(/^\/templates\//) });
    expect(snapshot.gallery.some((item) => item.id === "gal_gone")).toBe(false); // ast_gone no está READY
    const external = build({ ...base(), gallery: [{ id: "ext", src: "https://evil.example/x.png", alt: "x" }, { id: "proto", src: "//evil.example/x.png", alt: "x" }] });
    expect(external.snapshot.gallery).toEqual([]);
  });

  it("(29) es autocontenido y NO incluye propietario, correo, ids de Clerk ni datos de invitados", () => {
    const json = JSON.stringify(build().snapshot);
    for (const forbidden of ["ownerId", "userId", "clerk", "email", "@", "guest", "inviteToken", "usr_", "uploadAssetId"]) expect(json.toLowerCase(), forbidden).not.toContain(forbidden.toLowerCase());
  });

  it("(28) registra la plantilla: slug, identificador estable de versión y su configuración de tema completa", () => {
    const { snapshot } = build();
    expect(snapshot.template.slug).toBe("magnolia");
    expect(snapshot.template.config).toEqual(JSON.parse(JSON.stringify(magnoliaTemplate)));
    expect(snapshot.template.version).toBe(templateVersionId(magnoliaTemplate));
    expect(snapshot.template.version).toMatch(/^t1-[0-9a-f]{8}$/);
    expect(templateVersionId(ivoryTemplate)).not.toBe(templateVersionId(magnoliaTemplate));
    expect(templateVersionId({ ...magnoliaTemplate, colors: { ...magnoliaTemplate.colors, accent: "#000000" } })).not.toBe(templateVersionId(magnoliaTemplate));
  });

  it("es serializable (JSON) y no comparte referencias con el borrador (editar después no lo altera)", () => {
    const draft = base();
    const { snapshot } = build(draft);
    const frozen = JSON.stringify(snapshot);
    (draft.names as string[]).push("Otro");
    (draft.story.paragraphs as string[]).push("nuevo");
    expect(JSON.stringify(snapshot)).toBe(frozen);
    expect(isPublishedInvitation(JSON.parse(frozen))).toBe(true);
  });

  it("(46) cada publicación lleva su versión", () => {
    expect(build(base(), magnoliaTemplate, 1).snapshot.version).toBe(1);
    expect(build(base(), magnoliaTemplate, 2).snapshot.version).toBe(2);
  });
});

describe("snapshotToInvitation (lectura pública)", () => {
  it("(5) reconstruye la invitación con las URL derivadas de las claves y SIN ids internos", () => {
    const invitation = snapshotToInvitation(build().snapshot, mediaUrl);
    expect(invitation.cover.photo).toEqual({ src: "https://media.test/users/u/events/e/cover.webp", alt: "Portada", width: 1600, height: 900 });
    const json = JSON.stringify(invitation);
    for (const forbidden of ["mediaAssetId", "ast_cover", "ast_gal", "storageKey"]) expect(json, forbidden).not.toContain(forbidden);
    expect(invitation.id).toBe("published-andrea-y-fernando");
  });

  it("sin almacenamiento configurado las imágenes propias se omiten sin romper la invitación", () => {
    const invitation = snapshotToInvitation(build().snapshot, () => undefined);
    expect(invitation.cover.photo).toBeUndefined();
    expect(invitation.gallery.every((image) => image.src?.startsWith("/templates/"))).toBe(true);
  });

  it("dibuja EXACTAMENTE lo mismo que el borrador del que salió (mismo texto visible)", () => {
    const draft = { ...andreaFernandoInvitation };
    const published = snapshotToInvitation(buildPublishedInvitationSnapshot({ invitation: draft, template: magnoliaTemplate, assets: new Map(), version: 1, publishedAt: AT }).snapshot, mediaUrl);
    expect(visibleText(render(published, magnoliaTemplate))).toBe(visibleText(render(draft, magnoliaTemplate)));
  });

  it("(28) una invitación publicada se dibuja con la configuración con que se publicó, aunque la plantilla actual cambie", () => {
    const { snapshot } = build();
    const changedToday = { ...magnoliaTemplate, colors: { ...magnoliaTemplate.colors, accent: "#ff0000", bg: "#000000" } };
    const publishedTemplate = snapshot.template.config;
    expect(render(snapshotToInvitation(snapshot, mediaUrl), publishedTemplate)).not.toContain("#ff0000");
    expect(render(snapshotToInvitation(snapshot, mediaUrl), changedToday)).toContain("#ff0000");
  });

  it("(29) rechaza como snapshot lo que no tiene la forma esperada (lectura defensiva)", () => {
    for (const bad of [null, {}, { schemaVersion: 2 }, { schemaVersion: 1, slug: "x" }, "texto"]) expect(isPublishedInvitation(bad)).toBe(false);
  });
});

describe("Estado de publicación", () => {
  const cols = (over: Partial<Parameters<typeof derivePublicationState>[0]> = {}) => ({ status: "PUBLISHED" as const, draftRevision: 3, publishedRevision: 3, publishedVersion: 1, ...over });

  it("(32/54) Borrador · Publicado · Cambios sin publicar, derivados de las revisiones (no de «guardado»)", () => {
    expect(derivePublicationState(cols({ status: "DRAFT", publishedVersion: 0, publishedRevision: 0 }))).toBe("draft");
    expect(derivePublicationState(cols({ status: "UNPUBLISHED" }))).toBe("draft");
    expect(derivePublicationState(cols())).toBe("published");
    expect(derivePublicationState(cols({ draftRevision: 4 }))).toBe("changes");
    expect(derivePublicationState(cols({ draftRevision: 9, publishedVersion: 0, publishedRevision: 0 }))).toBe("published"); // dato anterior a D-29
  });

  it("etiquetas y botón principal: «Publicar» la primera vez y «Publicar cambios» después", () => {
    expect(publicationLabels).toEqual({ draft: "Borrador", published: "Publicado", changes: "Cambios sin publicar" });
    expect(publishActionLabel("draft")).toBe("Publicar");
    expect(publishActionLabel("changes")).toBe("Publicar cambios");
    expect(publishActionLabel("published")).toBe("Publicar cambios");
  });

  it("toPublicationInfo entrega la versión y las fechas en ISO", () => {
    expect(toPublicationInfo({ ...cols(), publishedAt: AT, lastPublishedAt: AT })).toEqual({ state: "published", version: 1, publishedAt: AT.toISOString(), lastPublishedAt: AT.toISOString() });
  });
});

describe("(35/36) Mínimo para publicar", () => {
  const ok = { names: ["Ana"], event: { startsAt: "2027-05-17T17:00:00-06:00", timezone: "America/Mexico_City" } };

  it("exige nombre, fecha válida y plantilla válida", () => {
    expect(validatePublishable(ok, true)).toEqual([]);
    expect(validatePublishable({ ...ok, names: ["", "  "] }, true).map((issue) => issue.field)).toEqual(["names"]);
    expect(validatePublishable({ ...ok, event: { startsAt: "nada", timezone: "America/Mexico_City" } }, true).map((issue) => issue.field)).toEqual(["event"]);
    expect(validatePublishable({ ...ok, event: { ...ok.event, timezone: "Marte/Olympus" } }, true).map((issue) => issue.field)).toEqual(["event"]);
    expect(validatePublishable(ok, false).map((issue) => issue.field)).toEqual(["template"]);
    expect(validatePublishable({ names: [], event: { startsAt: "x", timezone: "y" } }, false)).toHaveLength(3);
  });

  it("NO exige contenido opcional: un borrador con galería, regalos, sedes y música vacíos se puede publicar", () => {
    const empty: Invitation = { ...andreaFernandoInvitation, gallery: [], giftRegistry: undefined, music: undefined, locations: [], timeline: [] };
    expect(validatePublishable(empty, true)).toEqual([]);
    expect(() => build(empty)).not.toThrow();
  });
});
