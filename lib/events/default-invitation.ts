import { eventTypeConfigs, type OnboardingEventType } from "@/lib/events/event-types";
import type { EventLocation, Invitation, InvitationSection, InvitationSectionType } from "@/types/invitation";

/**
 * FÁBRICA DE CONTENIDO INICIAL (D-28): `createDefaultInvitationData` produce la invitación de un evento
 * NUEVO a partir del tipo, la plantilla y los datos esenciales. Pura y probada.
 *
 * Reglas del contenido inicial:
 *  - Copy NEUTRO y corto (nada de «Andrea & Fernando», nada de lorem ipsum): es editable.
 *  - Sin activos: ningún `MediaAsset`, sin portada propia (la plantilla usa su `heroBackdrop`), galería vacía.
 *  - Sin datos ficticios: sedes vacías, itinerario vacío (no se inventan horas), sin tiendas de regalos
 *    (no se asumen proveedores), sin música (equivale a «Sin música»: no hay `MusicSettings`).
 *  - RSVP habilitado con copy neutro y sin preguntas obligatorias.
 *  - Las secciones vacías existen y están visibles: la invitación PÚBLICA no las dibuja hasta que tengan
 *    contenido (los componentes de sección lo deciden); el editor sí muestra un aviso discreto.
 */
export type IdFactory = (prefix: string) => string;

/** Id opaco con prefijo (`evt_…`): solo `A-Za-z0-9_-`, apto para claves de fila y rutas. */
export const createEntityId: IdFactory = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

export interface DefaultInvitationInput {
  eventType: OnboardingEventType;
  templateSlug: string;
  /** Nombres con contenido: pareja → dos; un nombre → uno. */
  names: readonly string[];
  /** ISO 8601 con desfase. */
  startsAtIso: string;
  timezone: string;
  /** Slug público ya resuelto y único. */
  invitationSlug: string;
  newId?: IdFactory;
}

type Heading = Pick<InvitationSection, "eyebrow" | "title" | "subtitle">;

/** Encabezados de las secciones: los de una boda (mismo tono que Magnolia) y unos genéricos para el resto. */
const weddingHeadings: Partial<Record<InvitationSectionType, Heading>> = {
  story: { title: "Nuestra *historia*" },
  countdown: { title: "*Faltan*" },
  timeline: { title: "*Itinerario*", subtitle: "Un día lleno de momentos especiales" },
  gallery: { eyebrow: "Galería", title: "Nuestros *momentos*" },
  dressCode: { eyebrow: "Dress code" },
  giftRegistry: { eyebrow: "Mesa de regalos", title: "Tu presencia es nuestro mejor regalo" },
  rsvp: { eyebrow: "Confirma tu asistencia", title: "¡Nos encantaría contar *contigo!*" },
};

const genericHeadings: Partial<Record<InvitationSectionType, Heading>> = {
  story: { title: "Un día *especial*" },
  countdown: { title: "*Faltan*" },
  timeline: { title: "*Itinerario*" },
  gallery: { eyebrow: "Galería", title: "Nuestros *momentos*" },
  dressCode: { eyebrow: "Dress code" },
  giftRegistry: { eyebrow: "Mesa de regalos" },
  rsvp: { eyebrow: "Confirma tu asistencia", title: "¡Nos encantaría contar *contigo!*" },
};

/** Orden aprobado de las secciones (docs/ARCHITECTURE.md §4.3). La música no es una sección: es `MusicSettings`. */
export const defaultSectionOrder: readonly InvitationSectionType[] = ["hero", "story", "countdown", "locations", "timeline", "gallery", "dressCode", "giftRegistry", "rsvp", "footer"];

export function createDefaultInvitationData(input: DefaultInvitationInput): Invitation {
  const newId = input.newId ?? createEntityId;
  const config = eventTypeConfigs[input.eventType];
  const headings = input.eventType === "wedding" ? weddingHeadings : genericHeadings;

  const locations: EventLocation[] = config.locationKinds.map((kind) => ({ id: newId("loc"), kind, name: "", addressLines: [""] }));

  return {
    id: newId("inv"),
    slug: input.invitationSlug,
    contentVersion: 1,
    eventType: input.eventType,
    templateSlug: input.templateSlug,
    styleOverrides: {},

    names: [...input.names],
    event: { startsAt: input.startsAtIso, timezone: input.timezone },

    cover: { eyebrow: config.cover.eyebrow, tagline: config.cover.tagline, openLabel: "Abrir invitación" },
    story: { paragraphs: [config.story] },
    locations,
    timeline: [],
    gallery: [],
    dressCode: { style: "", description: "", palette: [] },
    // Sin `giftRegistry` (no hay tiendas ni mensaje) y sin `music`: nada que mostrar todavía.
    rsvp: { enabled: true, message: config.rsvpMessage, maxCompanions: 2, allowMaybe: true, askDietaryNotes: false },
    closing: { message: config.closing },

    sections: defaultSectionOrder.map((type): InvitationSection => ({ id: newId("sec"), type, isVisible: true, ...headings[type] })),
  };
}
