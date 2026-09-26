import type { EventCategoryId } from "@/types/marketing";
import type { EventLocation } from "@/types/invitation";

/**
 * TIPOS DE EVENTO del alta de eventos (D-28): etiquetas, forma de los nombres y copy neutro por tipo.
 * ÚNICA fuente: el onboarding, el servicio de creación y la fábrica de contenido inicial la consultan aquí
 * en vez de repetir textos. Los ids son el vocabulario de dominio (`EventCategoryId`), que `eventTypeToDb`
 * traduce a los valores estables de la base de datos (`WEDDING`, `QUINCEANERA`…).
 *
 * `KIDS` no es un tipo de evento del alta: es la categoría de las plantillas infantiles del catálogo.
 */
export type OnboardingEventType = Extract<EventCategoryId, "wedding" | "quinceanera" | "baptism" | "birthday" | "baby-shower" | "graduation" | "other">;

export type EventTypeIconKey = "heart" | "sparkles" | "baby" | "cake" | "gift" | "graduation" | "calendar";

export interface EventTypeConfig {
  id: OnboardingEventType;
  label: string;
  /** Una línea bajo la etiqueta en la tarjeta del paso 1. */
  description: string;
  icon: EventTypeIconKey;
  /** `couple`: dos nombres ("Andrea & Fernando"); `single`: un nombre (festejado o evento). */
  names: "couple" | "single";
  /** Etiqueta del campo cuando `names` es `single`. */
  singleNameLabel: string;
  singleNamePlaceholder: string;
  /** Sedes iniciales (vacías y editables). */
  locationKinds: readonly EventLocation["kind"][];
  cover: { eyebrow: string; tagline: string };
  story: string;
  rsvpMessage: string;
  closing: string;
}

const NEUTRAL_STORY = "Queremos compartir contigo un día muy especial.";
const NEUTRAL_RSVP = "Nos encantará contar contigo.";

export const eventTypeConfigs: Readonly<Record<OnboardingEventType, EventTypeConfig>> = {
  wedding: {
    id: "wedding",
    label: "Boda",
    description: "Tu día más esperado.",
    icon: "heart",
    names: "couple",
    singleNameLabel: "Nombres",
    singleNamePlaceholder: "",
    locationKinds: ["ceremony", "reception"],
    cover: { eyebrow: "Nos casamos", tagline: "Nos encantaría celebrar contigo" },
    story: NEUTRAL_STORY,
    rsvpMessage: NEUTRAL_RSVP,
    closing: "Gracias por ser parte de este día",
  },
  quinceanera: {
    id: "quinceanera",
    label: "XV años",
    description: "Una celebración inolvidable.",
    icon: "sparkles",
    names: "single",
    singleNameLabel: "Nombre de la quinceañera",
    singleNamePlaceholder: "Sofía",
    locationKinds: ["ceremony", "reception"],
    cover: { eyebrow: "Mis XV años", tagline: "Me encantaría celebrar contigo" },
    story: NEUTRAL_STORY,
    rsvpMessage: NEUTRAL_RSVP,
    closing: "Gracias por ser parte de este día",
  },
  baptism: {
    id: "baptism",
    label: "Bautizo",
    description: "Un momento para agradecer.",
    icon: "baby",
    names: "single",
    singleNameLabel: "Nombre del bautizado",
    singleNamePlaceholder: "Mateo",
    locationKinds: ["ceremony", "reception"],
    cover: { eyebrow: "Mi bautizo", tagline: "Nos encantaría celebrar contigo" },
    story: NEUTRAL_STORY,
    rsvpMessage: NEUTRAL_RSVP,
    closing: "Gracias por ser parte de este día",
  },
  birthday: {
    id: "birthday",
    label: "Cumpleaños",
    description: "Para festejar como se debe.",
    icon: "cake",
    names: "single",
    singleNameLabel: "Nombre del festejado",
    singleNamePlaceholder: "Laura",
    locationKinds: ["other"],
    cover: { eyebrow: "Mi cumpleaños", tagline: "Me encantaría celebrar contigo" },
    story: NEUTRAL_STORY,
    rsvpMessage: NEUTRAL_RSVP,
    closing: "Gracias por acompañarnos",
  },
  "baby-shower": {
    id: "baby-shower",
    label: "Baby shower",
    description: "Damos la bienvenida a un bebé.",
    icon: "gift",
    names: "single",
    singleNameLabel: "Nombre del bebé o de los papás",
    singleNamePlaceholder: "Baby Ruiz",
    locationKinds: ["other"],
    cover: { eyebrow: "Baby shower", tagline: "Nos encantaría celebrar contigo" },
    story: NEUTRAL_STORY,
    rsvpMessage: NEUTRAL_RSVP,
    closing: "Gracias por acompañarnos",
  },
  graduation: {
    id: "graduation",
    label: "Graduación",
    description: "Un logro que se comparte.",
    icon: "graduation",
    names: "single",
    singleNameLabel: "Nombre del graduado",
    singleNamePlaceholder: "Daniel",
    locationKinds: ["ceremony", "reception"],
    cover: { eyebrow: "Mi graduación", tagline: "Me encantaría celebrar contigo" },
    story: NEUTRAL_STORY,
    rsvpMessage: NEUTRAL_RSVP,
    closing: "Gracias por acompañarme",
  },
  other: {
    id: "other",
    label: "Otro",
    description: "Cualquier otra celebración.",
    icon: "calendar",
    names: "single",
    singleNameLabel: "Nombre del evento",
    singleNamePlaceholder: "Nuestra reunión",
    locationKinds: ["other"],
    cover: { eyebrow: "Estás invitado", tagline: "Nos encantaría contar contigo" },
    story: NEUTRAL_STORY,
    rsvpMessage: NEUTRAL_RSVP,
    closing: "Gracias por acompañarnos",
  },
};

/** Orden de las tarjetas del paso 1. */
export const onboardingEventTypes: readonly OnboardingEventType[] = ["wedding", "quinceanera", "baptism", "birthday", "baby-shower", "graduation", "other"];

export function isOnboardingEventType(value: unknown): value is OnboardingEventType {
  return typeof value === "string" && (onboardingEventTypes as readonly string[]).includes(value);
}

/** Etiqueta legible de un tipo de evento ("Boda", "XV años"…). Un valor desconocido devuelve el propio valor. */
export function eventTypeLabel(type: string): string {
  return isOnboardingEventType(type) ? eventTypeConfigs[type].label : type === "kids" ? "Infantil" : type;
}
