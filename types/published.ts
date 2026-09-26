import type {
  DressCodeSwatch,
  EventDate,
  InvitationClosing,
  InvitationSection,
  InvitationStory,
  MusicSettings,
  RSVPSettings,
  StyleOverrides,
  TimelineItem,
} from "@/types/invitation";
import type { EventCategoryId } from "@/types/marketing";
import type { InvitationTemplate } from "@/types/invitation-template";

/**
 * SNAPSHOT PUBLICADO (D-29). Lo ÚNICO que lee la página pública: contenido + plantilla + referencias a archivos,
 * autocontenido y serializable. NO contiene propietario, correo, ids de Clerk ni datos de invitados, y el RSVP
 * vivo (invitados, respuestas, preguntas) NO forma parte de él: solo la CONFIGURACIÓN publicada del RSVP.
 * Tipos explícitos (sin modelos de Prisma, sin `any`): `snapshotToInvitation` lo convierte al dominio de render.
 */
export const PUBLISHED_SCHEMA_VERSION = 1;

/** Imagen publicada: un asset ESTÁTICO de la plantilla (ruta en /public) o un archivo gestionado (por su clave). */
export type PublishedImage =
  | { kind: "static"; src: string; alt: string; width?: number; height?: number }
  | { kind: "asset"; mediaAssetId: string; storageKey: string; alt: string; width?: number; height?: number };

export interface PublishedLocation {
  id: string;
  kind: "ceremony" | "reception" | "other";
  name: string;
  addressLines: string[];
  time?: string;
  mapUrl?: string;
  photo?: PublishedImage;
}

export interface PublishedGalleryImage {
  id: string;
  caption?: string;
  image: PublishedImage;
}

export interface PublishedDressCode {
  style: string;
  description: string;
  palette: DressCodeSwatch[];
  illustration?: PublishedImage;
}

export interface PublishedGiftRegistry {
  message: string;
  entries: { id: string; name: string; url: string }[];
  moreUrl?: string;
  photo?: PublishedImage;
}

export interface PublishedCover {
  eyebrow?: string;
  tagline?: string;
  openLabel: string;
  photo?: PublishedImage;
}

/** Orden y visibilidad de las secciones tal como se publicaron. */
export type PublishedSection = InvitationSection;

export interface PublishedTemplate {
  slug: string;
  /** Identificador estable de la versión del diseño con la que se publicó (`templateVersion`). */
  version: string;
  /** Configuración del tema COMPLETA en el momento de publicar: si la plantilla cambia mañana, esta invitación no. */
  config: InvitationTemplate;
}

export interface PublishedInvitation {
  schemaVersion: typeof PUBLISHED_SCHEMA_VERSION;
  /** 1, 2, 3… (cada publicación incrementa). */
  version: number;
  publishedAt: string;
  template: PublishedTemplate;

  slug: string;
  contentVersion: number;
  eventType: EventCategoryId;
  names: string[];
  event: EventDate;
  styleOverrides: Record<string, StyleOverrides>;

  cover: PublishedCover;
  story: InvitationStory;
  locations: PublishedLocation[];
  timeline: TimelineItem[];
  gallery: PublishedGalleryImage[];
  dressCode?: PublishedDressCode;
  giftRegistry?: PublishedGiftRegistry;
  music?: MusicSettings;
  rsvp: RSVPSettings;
  closing: InvitationClosing;
  sections: PublishedSection[];
}

/** Estado de publicación de una invitación (visible al usuario). No es `Template.publicationStatus`. */
export type PublicationState = "draft" | "published" | "changes";

export interface PublicationInfo {
  state: PublicationState;
  /** Versión publicada vigente (0 = nunca publicada). */
  version: number;
  publishedAt?: string;
  lastPublishedAt?: string;
}
