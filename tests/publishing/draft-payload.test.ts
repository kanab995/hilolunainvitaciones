import { describe, expect, it } from "vitest";
import { applyDraftPayload, invitationToDraftPayload, parseDraftPayload, type DraftPayload } from "@/lib/editor/draft-payload";
import { validateInvitation } from "@/lib/editor/validation";
import { createDefaultInvitationData } from "@/lib/events/default-invitation";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import type { Invitation } from "@/types/invitation";

const fresh = (): Invitation =>
  createDefaultInvitationData({ eventType: "wedding", templateSlug: "magnolia", names: ["Sofía", "Diego"], startsAtIso: "2027-05-17T17:00:00-06:00", timezone: "America/Mexico_City", invitationSlug: "sofia-y-diego" });

const parse = (raw: unknown) => {
  const result = parseDraftPayload(raw);
  if (!result.ok) throw new Error(result.message);
  return result.value;
};

/** La invitación de la demostración con una imagen propia de portada y otra en una sede (como las devuelve el editor). */
const withManagedImages = (): Invitation => ({
  ...andreaFernandoInvitation,
  cover: { ...andreaFernandoInvitation.cover, photo: { src: "https://media.test/users/u/events/e/c.webp", alt: "Portada", mediaAssetId: "ast_cover" } },
  locations: andreaFernandoInvitation.locations.map((location, index) => (index === 0 ? { ...location, photo: { src: "https://media.test/users/u/events/e/l.webp", alt: "Sede", mediaAssetId: "ast_loc" } } : location)),
  gallery: [...andreaFernandoInvitation.gallery, { id: "gal_own", src: "https://media.test/g.webp", alt: "Propia", mediaAssetId: "ast_gal" }],
});

describe("Payload del borrador: dominio → DTO (cliente)", () => {
  it("no incluye URL, blob:, archivos ni ids de archivos, propietario o estados de publicación", () => {
    const json = JSON.stringify(invitationToDraftPayload({ ...withManagedImages(), cover: { ...andreaFernandoInvitation.cover, photo: { src: "blob:http://x/y", alt: "local", mediaAssetId: "ast_cover" } } }, 3));
    for (const forbidden of ["blob:", "media.test", "mediaAssetId", "ast_cover", "ast_loc", "ast_gal", "ownerId", "publish", "clerk", "src"]) expect(json, forbidden).not.toContain(forbidden);
  });

  it("solo lleva el texto alternativo de las imágenes PROPIAS (las estáticas de la plantilla no se editan por aquí)", () => {
    const payload = invitationToDraftPayload(withManagedImages(), 1);
    expect(payload.cover.photoAlt).toBe("Portada");
    expect(payload.locations[0]?.photoAlt).toBe("Sede");
    expect(payload.locations[1]?.photoAlt).toBeUndefined();
  });
});

describe("parseDraftPayload: lista blanca (servidor)", () => {
  const good = () => invitationToDraftPayload(fresh(), 4);

  it("acepta el payload del editor y conserva la revisión base", () => {
    expect(parseDraftPayload(good())).toMatchObject({ ok: true, value: { baseRevision: 4, templateSlug: "magnolia", names: ["Sofía", "Diego"] } });
  });

  it("10. ignora cualquier campo que no sea de la lista blanca (ownerId, clerkUserId, createdAt, estado de publicación, ids de invitación)", () => {
    const value = parse({ ...good(), ownerId: "usr_B", clerkUserId: "user_x", createdAt: "2001", publishedVersion: 99, status: "PUBLISHED", invitationId: "inv_otra", eventId: "evt_otra", templateStatus: "PUBLISHED", event: { ...good().event, ownerId: "usr_B" } });
    expect(Object.keys(value).sort()).toEqual(["baseRevision", "closing", "cover", "dressCode", "event", "gallery", "giftRegistry", "locations", "music", "names", "rsvp", "sections", "story", "styleOverrides", "templateSlug", "timeline"]);
    expect(JSON.stringify(value)).not.toMatch(/usr_B|user_x|inv_otra|evt_otra|PUBLISHED/);
  });

  it("rechaza payloads sin revisión, sin plantilla válida o con fecha ilegible", () => {
    expect(parseDraftPayload(null).ok).toBe(false);
    expect(parseDraftPayload({ ...good(), baseRevision: 0 }).ok).toBe(false);
    expect(parseDraftPayload({ ...good(), baseRevision: "3" }).ok).toBe(false);
    expect(parseDraftPayload({ ...good(), templateSlug: "../x" }).ok).toBe(false);
    expect(parseDraftPayload({ ...good(), event: { startsAt: "no es fecha", timezone: "UTC" } }).ok).toBe(false);
  });

  it("descarta ids con formato inválido, elementos duplicados y acota el tamaño de las listas", () => {
    const value = parse({
      ...good(),
      timeline: [{ id: "../hack", time: "1", label: "x" }, { id: "ok_1", time: "10:00", label: "Cena", icon: "dinner" }, { id: "ok_1", time: "11:00", label: "Repetido" }],
      locations: Array.from({ length: 50 }, (_, i) => ({ id: `loc_${i}`, kind: "ceremony", name: "x", addressLines: [""] })),
    });
    expect(value.timeline.map((item) => item.id)).toEqual(["ok_1"]);
    expect(value.locations).toHaveLength(20);
  });

  it("los enumerados desconocidos caen a un valor seguro y la música externa nunca se reproduce sola", () => {
    const value = parse({ ...good(), locations: [{ id: "l1", kind: "castillo", name: "x", addressLines: [""] }], timeline: [{ id: "t1", time: "1", label: "x", icon: "rayo" }], music: { externalUrl: "https://example.com/a", title: "t", autoplayAfterInteraction: true, volume: 9, loop: true } });
    expect(value.locations[0]?.kind).toBe("other");
    expect(value.timeline[0]?.icon).toBe("other");
    expect(value.music).toMatchObject({ autoplayAfterInteraction: false, volume: 1 });
  });

  it("los estilos por plantilla se sanean (acento hexadecimal y solo fuentes aprobadas)", () => {
    const value = parse({ ...good(), styleOverrides: { magnolia: { accent: "rojo", fonts: { names: "comic-sans", tagline: "inter" } }, "NO VALIDO": { accent: "#112233" } } });
    expect(value.styleOverrides).toEqual({ magnolia: { fonts: { tagline: "inter" } } });
  });
});

describe("applyDraftPayload: DTO + borrador actual → nuevo borrador", () => {
  it("un payload construido desde el propio borrador no cambia nada (idempotente)", () => {
    const current = fresh();
    const next = applyDraftPayload(current, parse(invitationToDraftPayload(current, 1)));
    expect(JSON.parse(JSON.stringify(next))).toEqual(JSON.parse(JSON.stringify(current)));
  });

  it("guarda textos, nombres, fecha, zona, historia (con saltos de párrafo) y cierre", () => {
    const dto = parse({ ...invitationToDraftPayload(fresh(), 1), names: ["Ana", "Luis"], event: { startsAt: "2028-01-02T09:30:00-06:00", timezone: "America/Cancun" }, story: { paragraphs: ["Uno.", "Dos\ncon salto."] }, closing: { message: "Gracias" } });
    const next = applyDraftPayload(fresh(), dto);
    expect(next.names).toEqual(["Ana", "Luis"]);
    expect(next.event).toEqual({ startsAt: "2028-01-02T09:30:00-06:00", timezone: "America/Cancun" });
    expect(next.story.paragraphs).toEqual(["Uno.", "Dos\ncon salto."]);
    expect(next.closing.message).toBe("Gracias");
  });

  it("13/12. la visibilidad y el orden de las secciones salen del payload; una sección desconocida se ignora y las omitidas se conservan al final", () => {
    const current = fresh();
    const reversed = [...current.sections].reverse();
    const dto = parse({ ...invitationToDraftPayload(current, 1), sections: [{ id: "no_existe", isVisible: true }, ...reversed.slice(0, 3).map((section) => ({ id: section.id, isVisible: false }))] });
    const next = applyDraftPayload(current, dto);
    expect(next.sections).toHaveLength(current.sections.length);
    expect(next.sections.slice(0, 3).map((section) => section.id)).toEqual(reversed.slice(0, 3).map((section) => section.id));
    expect(next.sections.slice(0, 3).every((section) => !section.isVisible)).toBe(true);
    expect(new Set(next.sections.map((section) => section.id)).size).toBe(current.sections.length);
    expect(next.sections.map((section) => section.type)).not.toContain(undefined);
  });

  it("15. sedes: crear, editar, eliminar y reordenar; la imagen propia de una sede existente se conserva", () => {
    const current = withManagedImages();
    const dto = parse({
      ...invitationToDraftPayload(current, 1),
      locations: [
        { id: "loc_reception", kind: "reception", name: "Nueva recepción", addressLines: ["Av. 1"], photoAlt: "otro texto" },
        { id: "loc_nueva", kind: "other", name: "Jardín", addressLines: ["Calle 2"], time: "20:00" },
      ],
    });
    const next = applyDraftPayload(current, dto);
    expect(next.locations.map((location) => location.id)).toEqual(["loc_reception", "loc_nueva"]); // orden del DTO; loc_ceremony eliminada
    expect(next.locations[0]?.photo?.src).toBe(andreaFernandoInvitation.locations[1]?.photo?.src); // estática conservada
    expect(next.locations[1]?.photo).toBeUndefined();
    const own = applyDraftPayload(current, parse({ ...invitationToDraftPayload(current, 1), locations: [{ id: "loc_ceremony", kind: "ceremony", name: "X", addressLines: [""], photoAlt: "Nuevo alt" }] }));
    expect(own.locations[0]?.photo).toMatchObject({ mediaAssetId: "ast_loc", alt: "Nuevo alt" });
  });

  it("16/18. itinerario y mesa de regalos: crear, editar, eliminar y reordenar por id", () => {
    const dto = parse({
      ...invitationToDraftPayload(andreaFernandoInvitation, 1),
      timeline: [{ id: "tl_5", time: "23:00", label: "Brindis" }, { id: "tl_nuevo", time: "12:00", label: "Nuevo" }],
      giftRegistry: { message: "Hola", entries: [{ id: "gift_2", name: "Amazon", url: "https://a.com" }, { id: "gift_x", name: "Otra", url: "https://b.com" }] },
    });
    const next = applyDraftPayload(andreaFernandoInvitation, dto);
    expect(next.timeline.map((item) => item.id)).toEqual(["tl_5", "tl_nuevo"]);
    expect(next.giftRegistry?.entries.map((entry) => entry.id)).toEqual(["gift_2", "gift_x"]);
    expect(next.giftRegistry?.photo).toEqual(andreaFernandoInvitation.giftRegistry?.photo);
  });

  it("17. galería: solo alt, pie y orden de las filas existentes; nunca crea ni borra filas ni toca sus imágenes", () => {
    const current = withManagedImages();
    const dto = parse({ ...invitationToDraftPayload(current, 1), gallery: [{ id: "gal_own", alt: "Nuevo alt" }, { id: "no_existe", alt: "x" }, { id: "gal_couple", alt: "Pareja", caption: "Pie" }] });
    const next = applyDraftPayload(current, dto);
    expect(next.gallery).toHaveLength(current.gallery.length);
    expect(next.gallery.slice(0, 2).map((image) => image.id)).toEqual(["gal_own", "gal_couple"]);
    expect(next.gallery[0]).toMatchObject({ alt: "Nuevo alt", mediaAssetId: "ast_gal", src: "https://media.test/g.webp" });
    expect(next.gallery[1]).toMatchObject({ caption: "Pie", src: andreaFernandoInvitation.gallery[0]?.src });
  });

  it("19/20. RSVP y música: se guarda la configuración; una música de biblioteca existente no se pisa", () => {
    const dto = parse({ ...invitationToDraftPayload(andreaFernandoInvitation, 1), rsvp: { enabled: false, message: "Cerrado", maxCompanions: 1, allowMaybe: false, askDietaryNotes: true }, music: null });
    const next = applyDraftPayload(andreaFernandoInvitation, dto);
    expect(next.rsvp).toMatchObject({ enabled: false, message: "Cerrado", maxCompanions: 1, askDietaryNotes: true });
    expect(next.music).toBeUndefined();
    const library = { ...andreaFernandoInvitation, music: { sourceType: "library" as const, title: "Pista", autoplayAfterInteraction: true, volume: 0.5, loop: true, libraryTrackId: "trk" } };
    expect(applyDraftPayload(library, parse({ ...invitationToDraftPayload(library, 1), music: null })).music).toEqual(library.music);
  });

  it("el resultado se valida con las MISMAS reglas del editor (una sola fuente de validación)", () => {
    const bad = applyDraftPayload(fresh(), parse({ ...invitationToDraftPayload(fresh(), 1), names: ["", ""], giftRegistry: { message: "", entries: [{ id: "g1", name: "", url: "no-es-url" }] } }));
    const errors = validateInvitation(bad);
    expect(errors["names.0"]).toBeDefined();
    expect(errors["giftRegistry.g1.url"]).toBeDefined();
    expect(validateInvitation(fresh())).toEqual({});
  });

  it("no cambia lo que no le pertenece: id, slug público, tipo de evento y versión del contenido", () => {
    const current = fresh();
    const next = applyDraftPayload(current, parse({ ...invitationToDraftPayload(current, 1), id: "otro", slug: "otro", eventType: "birthday" }));
    expect(next).toMatchObject({ id: current.id, slug: current.slug, eventType: "wedding", contentVersion: current.contentVersion });
  });
});

describe("El payload completo de un borrador nuevo cabe en un guardado", () => {
  it("es JSON serializable y pequeño", () => {
    const payload: DraftPayload = invitationToDraftPayload(fresh(), 1);
    expect(JSON.stringify(payload).length).toBeLessThan(6000);
  });
});
