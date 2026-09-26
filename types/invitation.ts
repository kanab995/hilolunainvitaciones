import type { EventCategoryId } from "@/types/marketing";

/**
 * DATA — datos de una invitación (lo que introduce el usuario).
 *
 * Contrato de separación (CLAUDE.md reglas 15–17, docs/ARCHITECTURE.md §4):
 *  - Este módulo describe SOLO contenido. Aquí no hay colores, tipografías, layouts, decoraciones,
 *    animaciones ni nada visual: eso vive en `InvitationTemplate` (`types/invitation-template.ts`).
 *  - La única referencia a la plantilla es `templateSlug`. Cambiar de plantilla cambia solo ese
 *    campo (`lib/invitation/change-template.ts`); todo lo demás permanece intacto.
 *  - Este archivo NO importa nada de `types/invitation-template.ts` (y viceversa): lo comprueba
 *    `tests/invitation/separation.test.ts`.
 *
 * Todos los campos son `readonly`: una invitación se trata como inmutable; editarla produce una
 * copia. Las fechas son cadenas ISO 8601 (serializables; futura BD/snapshot).
 */

/** Referencia a una imagen. Sin `src` el renderizador dibuja un placeholder neutro. */
export interface ImageRef {
  /** TODO(asset): replace with approved Hilo Luna asset. */
  src?: string;
  /** Texto alternativo real (accesibilidad). */
  alt: string;
  width?: number;
  height?: number;
  /**
   * Archivo gestionado (MediaAsset) del que sale la imagen. Solo lo rellena el EDITOR del propietario:
   * la invitación pública nunca lo lleva. Sin él, `src` es un asset estático de la plantilla.
   */
  mediaAssetId?: string;
}

/** Fecha canónica del evento (docs/ARCHITECTURE.md §4.7): instante con desfase + zona IANA. */
export interface EventDate {
  /** ISO 8601 con desfase, p. ej. "2027-05-17T17:00:00-06:00". */
  startsAt: string;
  /** Zona horaria IANA, p. ej. "America/Mexico_City". */
  timezone: string;
}

/** Sede del evento. La invitación tiene una lista (`Invitation.locations`); un solo bloque. */
export interface EventLocation {
  id: string;
  kind: "ceremony" | "reception" | "other";
  /** Nombre del lugar ("Parroquia de San Miguel Arcángel"). */
  name: string;
  /** Líneas de dirección, en orden. */
  addressLines: readonly string[];
  /** Hora local de la sede, legible ("17:00 hrs"). */
  time?: string;
  /** Enlace para llegar (mapa). Solo enlace: no se incrusta ningún mapa de terceros. */
  mapUrl?: string;
  photo?: ImageRef;
}

/** Elemento del itinerario. */
export interface TimelineItem {
  id: string;
  /** Hora legible ("17:00"). */
  time: string;
  label: string;
  /** Clave semántica del ícono; cada plantilla/renderizador la traduce a un dibujo. */
  icon: "ceremony" | "cocktail" | "dinner" | "party" | "toast" | "other";
  description?: string;
}

export interface GalleryImage extends ImageRef {
  id: string;
  caption?: string;
}

/** Color sugerido del código de vestimenta (contenido: lo elige el usuario). */
export interface DressCodeSwatch {
  name?: string;
  /** Color hexadecimal "#RRGGBB". */
  hex: string;
}

export interface DressCode {
  /** Estilo ("Formal y elegante"). */
  style: string;
  description: string;
  palette: readonly DressCodeSwatch[];
  illustration?: ImageRef;
}

/** Tienda o enlace de la mesa de regalos. Sin logos de terceros: solo nombre y enlace. */
export interface GiftRegistryEntry {
  id: string;
  name: string;
  url: string;
}

export interface GiftRegistry {
  message: string;
  entries: readonly GiftRegistryEntry[];
  /** "Ver más opciones". */
  moreUrl?: string;
  photo?: ImageRef;
}

/** Ajustes de confirmación de asistencia. "Tal vez" cuenta como Pendiente (CLAUDE.md, decisión 8). */
export interface RSVPSettings {
  enabled: boolean;
  /** Fecha límite para confirmar (ISO 8601). Pasada, el formulario se cierra. */
  deadline?: string;
  message: string;
  /** Texto del botón de confirmación. Sin valor se usa el genérico ("Confirmar asistencia"). */
  ctaLabel?: string;
  /** Máximo de acompañantes por invitación (0 = solo el invitado). */
  maxCompanions: number;
  /** Permite responder "Tal vez". */
  allowMaybe: boolean;
  /** Pide restricciones alimentarias. */
  askDietaryNotes: boolean;
}

/** Origen del audio (docs/ARCHITECTURE.md §10.1). Solo arquitectura: no hay proveedores. */
export type MusicSourceType = "library" | "upload" | "external";

export interface MusicSettings {
  sourceType: MusicSourceType;
  /** Resuelto por el servidor (library/upload); nunca lo escribe el usuario. */
  trackUrl?: string;
  /** Solo `external`: https obligatorio. Es un enlace, no un reproductor. */
  externalUrl?: string;
  title: string;
  artist?: string;
  /** Forzado a `false` si `sourceType = "external"`. La reproducción solo empieza tras un gesto. */
  autoplayAfterInteraction: boolean;
  /** 0..1 */
  volume: number;
  loop: boolean;
  libraryTrackId?: string;
  uploadAssetId?: string;
}

/** Portada. */
export interface InvitationCover {
  /** Etiqueta superior opcional ("Nuestra boda"). */
  eyebrow?: string;
  /** Frase bajo los nombres ("Nos encantaría celebrar contigo"). */
  tagline?: string;
  /** Texto del botón de apertura. */
  openLabel: string;
  photo?: ImageRef;
}

export interface InvitationStory {
  paragraphs: readonly string[];
}

export interface InvitationClosing {
  message: string;
}

/** Tipos de sección que el renderizador sabe dibujar. */
export type InvitationSectionType =
  | "hero"
  | "story"
  | "countdown"
  | "locations"
  | "timeline"
  | "gallery"
  | "dressCode"
  | "giftRegistry"
  | "rsvp"
  | "footer";

/**
 * Una entrada del orden de la invitación: qué sección va, en qué posición, si es visible y sus
 * encabezados. El CONTENIDO de cada sección vive en `Invitation` (por tipo); aquí solo hay orden,
 * visibilidad y textos de encabezado que edita el usuario. Ocultar no borra nada (regla 17).
 */
export interface InvitationSection {
  id: string;
  type: InvitationSectionType;
  isVisible: boolean;
  /** Etiqueta superior ("Dress code"). */
  eyebrow?: string;
  /** Titular; marca la palabra en cursiva con asteriscos ("Nuestra *historia*"). */
  title?: string;
  subtitle?: string;
  /** Ajuste del usuario, agnóstico de plantilla (mockup 04). */
  align?: "left" | "center" | "right";
  /** Ajuste del usuario: velo sobre la imagen para mejorar la legibilidad del texto (portada). */
  overlay?: boolean;
}

/**
 * Fuentes que el usuario puede elegir. Solo las registradas y aprobadas en docs/ASSET_LICENSES.md §3
 * (Playfair Display y Montserrat siguen `pendiente`: no se ofrecen hasta incorporarlas).
 */
export type FontChoice = "cormorant" | "inter";

/** Personalizaciones del usuario POR plantilla (acento y fuentes; docs/ARCHITECTURE.md §4.4). */
export interface StyleOverrides {
  /** Color hexadecimal "#RRGGBB". */
  accent?: string;
  /** Fuente de los nombres y de la frase de la portada. Sin valor: la de la plantilla. */
  fonts?: { names?: FontChoice; tagline?: FontChoice };
}

export interface Invitation {
  id: string;
  /** Identificador público de URL (`/i/[slug]`). */
  slug: string;
  /** Versión del esquema del contenido (migraciones futuras). */
  contentVersion: number;
  eventType: EventCategoryId;
  /** ÚNICA referencia a la plantilla visual. */
  templateSlug: string;
  /** Personalizaciones por plantilla; volver a una plantilla anterior las restaura. */
  styleOverrides?: Readonly<Record<string, StyleOverrides>>;

  /** Nombres de los anfitriones o festejados, uno por elemento: ["Andrea", "Fernando"]. */
  names: readonly string[];
  event: EventDate;
  cover: InvitationCover;
  story: InvitationStory;
  locations: readonly EventLocation[];
  timeline: readonly TimelineItem[];
  gallery: readonly GalleryImage[];
  dressCode?: DressCode;
  giftRegistry?: GiftRegistry;
  music?: MusicSettings;
  rsvp: RSVPSettings;
  closing: InvitationClosing;

  /** Orden y visibilidad de las secciones. */
  sections: readonly InvitationSection[];
}
