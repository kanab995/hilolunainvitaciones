import { describe, expect, it } from "vitest";
import { andreaFernandoInvitation } from "@/lib/invitation/mock/andrea-fernando";
import { dbInvitationToDomain, domainInvitationToDb, type InvitationAggregateRow, type MediaRefRow } from "@/server/mappers/invitation";
import { getDemoRows } from "@/server/repositories/demo-store";
import { buildMediaUrl } from "@/server/storage/public-url";

const NOW = new Date("2026-09-25T12:00:00Z");
const BASE = "https://media.test";
const options = { mediaUrl: (key: string) => buildMediaUrl(BASE, key) };
const ownerOptions = { ...options, exposeMediaIds: true };

const media = (id: string, over: Partial<MediaRefRow> = {}): MediaRefRow => ({ id, storageKey: `users/u/events/e/${id.padEnd(32, "0")}.webp`, status: "READY", width: 1600, height: 900, ...over });

/** La invitación del seed + archivos gestionados como los devolvería Prisma. */
function withMedia(): InvitationAggregateRow {
  const row = getDemoRows(NOW).invitation;
  return {
    ...row,
    coverAlt: "Andrea y Fernando",
    coverMedia: media("cover1"),
    event: {
      ...row.event,
      locations: row.event.locations.map((location, index) => (index === 0 ? { ...location, imagePath: null, mediaAssetId: "loc1", mediaAsset: media("loc1"), imageAlt: "La parroquia" } : location)),
      galleryImages: [...row.event.galleryImages, { id: "gal_new", src: null, mediaAssetId: "gal1", mediaAsset: media("gal1"), alt: "Brindis", width: null, height: null, caption: null, position: row.event.galleryImages.length }],
    },
  };
}

describe("Mapper: archivos gestionados → dominio", () => {
  it("14. la invitación PÚBLICA recibe las URL persistidas y NINGÚN id interno", () => {
    const invitation = dbInvitationToDomain(withMedia(), options);
    expect(invitation.cover.photo).toMatchObject({ src: `${BASE}/users/u/events/e/${"cover1".padEnd(32, "0")}.webp`, alt: "Andrea y Fernando", width: 1600, height: 900 });
    expect(invitation.locations[0]?.photo?.src).toContain(BASE);
    expect(invitation.gallery.at(-1)).toMatchObject({ id: "gal_new", alt: "Brindis" });
    const json = JSON.stringify(invitation);
    expect(json).not.toContain("mediaAssetId");
    for (const secret of ["cover1", "loc1", "gal1", "ownerId", "storageKey", "usr_"]) expect(json.replace(/users\/u\/events\/e\/[^"]+/g, "URL"), secret).not.toContain(secret);
  });

  it("el EDITOR del propietario sí recibe los ids (los necesita para operar)", () => {
    const invitation = dbInvitationToDomain(withMedia(), ownerOptions);
    expect(invitation.cover.photo?.mediaAssetId).toBe("cover1");
    expect(invitation.locations[0]?.photo?.mediaAssetId).toBe("loc1");
    expect(invitation.gallery.at(-1)?.mediaAssetId).toBe("gal1");
    expect(invitation.gallery[0]?.mediaAssetId).toBeUndefined(); // las estáticas no tienen
  });

  it("15. los assets estáticos de la plantilla siguen funcionando SIN almacenamiento configurado", () => {
    const seed = getDemoRows(NOW).invitation;
    const invitation = dbInvitationToDomain(seed); // sin `mediaUrl`, como sin S3
    expect(JSON.parse(JSON.stringify(invitation))).toEqual(JSON.parse(JSON.stringify(andreaFernandoInvitation)));
    expect(invitation.cover.photo).toBeUndefined(); // la portada usa el fondo de la plantilla (heroBackdrop)
    expect(invitation.gallery.every((image) => image.src?.startsWith("/templates/"))).toBe(true);
    expect(invitation.locations.every((location) => !location.photo || location.photo.src?.startsWith("/templates/"))).toBe(true);
  });

  it("si hay archivos pero no hay URL pública (sin S3), la invitación pública NO los muestra ni se rompe", () => {
    const invitation = dbInvitationToDomain(withMedia());
    expect(invitation.cover.photo).toBeUndefined();
    expect(invitation.gallery.at(-1)?.src).toBeUndefined();
    expect(invitation.locations[0]?.photo).toBeUndefined(); // la estática de la sede se retiró al elegir la propia
  });

  it("un archivo que no está READY (PENDING o eliminado) nunca se publica", () => {
    for (const status of ["PENDING", "DELETED"] as const) {
      const row = withMedia();
      const invitation = dbInvitationToDomain({ ...row, coverMedia: media("c", { status }) }, options);
      expect(invitation.cover.photo).toBeUndefined();
    }
  });

  it("la imagen propia de una sede manda sobre la estática; sin ella queda la de Magnolia", () => {
    const row = withMedia();
    const seedLocations = getDemoRows(NOW).invitation.event.locations;
    const inv = dbInvitationToDomain(row, options);
    expect(inv.locations[0]?.photo?.src).toContain(BASE);
    expect(inv.locations[1]?.photo?.src).toBe(seedLocations[1]?.imagePath); // la otra sede conserva su asset estático
    const removed = dbInvitationToDomain({ ...row, event: { ...row.event, locations: seedLocations } }, options);
    expect(removed.locations[0]?.photo?.src).toBe(seedLocations[0]?.imagePath);
  });
});

describe("Mapper: dominio → BD (referencias, no URL)", () => {
  it("una imagen gestionada se guarda como mediaAssetId (sin src/URL); una estática, como ruta", () => {
    const invitation = dbInvitationToDomain(withMedia(), ownerOptions);
    const write = domainInvitationToDb(invitation);
    const managedGallery = write.galleryImages.at(-1)!;
    expect(managedGallery).toMatchObject({ mediaAssetId: "gal1", src: null });
    expect(write.galleryImages[0]).toMatchObject({ mediaAssetId: null, src: expect.stringMatching(/^\/templates\//) });
    expect(write.locations[0]).toMatchObject({ mediaAssetId: "loc1", imagePath: null });
    expect(write.locations[1]?.mediaAssetId).toBeNull();
    expect(JSON.stringify(write)).not.toContain(BASE); // ninguna URL pública llega a la BD
  });

  it("la foto de portada gestionada NO se copia al JSON de la sección (vive en Invitation.coverMediaId)", () => {
    const invitation = dbInvitationToDomain(withMedia(), ownerOptions);
    const hero = domainInvitationToDb(invitation).sections.find((section) => section.type === "COVER");
    expect(JSON.stringify(hero?.content)).not.toContain("mediaAssetId");
    expect(JSON.stringify(hero?.content)).not.toContain(BASE);
  });
});
