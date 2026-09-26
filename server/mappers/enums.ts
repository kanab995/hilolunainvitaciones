import type { BlockType, EventType, LocationKind, MusicSourceType, TemplateDesignStatus, TemplateFeature, TemplateStyle, TimelineIcon } from "@prisma/client";
import type { EventCategoryId } from "@/types/marketing";
import type { EventLocation, InvitationSectionType, MusicSourceType as DomainMusicSource, TimelineItem } from "@/types/invitation";
import type { TemplateFeatureId, TemplateStatus, TemplateStyleId } from "@/types/templates";

/**
 * Traducción entre el vocabulario del dominio (minúsculas, el que usa la interfaz) y los enums de la
 * base de datos (MAYÚSCULAS). Tablas explícitas: si un valor se añade en un lado, el compilador lo
 * exige en el otro. `invert` construye la dirección contraria.
 */
function invert<K extends string, V extends string>(table: Record<K, V>): Record<V, K> {
  return Object.fromEntries(Object.entries(table).map(([key, value]) => [value, key])) as Record<V, K>;
}

export const eventTypeToDb: Record<EventCategoryId, EventType> = {
  wedding: "WEDDING",
  quinceanera: "QUINCEANERA",
  baptism: "BAPTISM",
  birthday: "BIRTHDAY",
  "baby-shower": "BABY_SHOWER",
  kids: "KIDS",
  graduation: "GRADUATION",
  other: "OTHER",
};
export const eventTypeFromDb = invert(eventTypeToDb);

export const templateStyleToDb: Record<TemplateStyleId, TemplateStyle> = {
  floral: "FLORAL",
  romantic: "ROMANTIC",
  minimal: "MINIMAL",
  elegant: "ELEGANT",
  rustic: "RUSTIC",
  modern: "MODERN",
  destination: "DESTINATION",
  themed: "THEMED",
  kids: "KIDS",
};
export const templateStyleFromDb = invert(templateStyleToDb);

export const templateFeatureToDb: Record<TemplateFeatureId, TemplateFeature> = {
  music: "MUSIC",
  rsvp: "RSVP",
  gallery: "GALLERY",
  countdown: "COUNTDOWN",
  location: "LOCATION",
  gifts: "GIFTS",
};
export const templateFeatureFromDb = invert(templateFeatureToDb);

/** Madurez del diseño. NO es la publicación del catálogo (`TemplatePublicationStatus`). */
export const designStatusToDb: Record<TemplateStatus, TemplateDesignStatus> = {
  implemented: "IMPLEMENTED",
  concept: "CONCEPT",
  comingSoon: "COMING_SOON",
};
export const designStatusFromDb = invert(designStatusToDb);

export const sectionTypeToDb: Record<InvitationSectionType, BlockType> = {
  hero: "COVER",
  story: "STORY",
  countdown: "COUNTDOWN",
  locations: "LOCATION",
  timeline: "ITINERARY",
  gallery: "GALLERY",
  dressCode: "DRESS_CODE",
  giftRegistry: "GIFTS",
  rsvp: "RSVP",
  footer: "CLOSING",
};
export const sectionTypeFromDb = invert(sectionTypeToDb);

export const locationKindToDb: Record<EventLocation["kind"], LocationKind> = { ceremony: "CEREMONY", reception: "RECEPTION", other: "OTHER" };
export const locationKindFromDb = invert(locationKindToDb);

export const timelineIconToDb: Record<TimelineItem["icon"], TimelineIcon> = {
  ceremony: "CEREMONY",
  cocktail: "COCKTAIL",
  dinner: "DINNER",
  party: "PARTY",
  toast: "TOAST",
  other: "OTHER",
};
export const timelineIconFromDb = invert(timelineIconToDb);

export const musicSourceToDb: Record<DomainMusicSource, MusicSourceType> = { library: "LIBRARY", upload: "UPLOAD", external: "EXTERNAL" };
export const musicSourceFromDb = invert(musicSourceToDb);
