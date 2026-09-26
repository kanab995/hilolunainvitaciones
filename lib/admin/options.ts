import { eventTypeLabel } from "@/lib/events/event-types";

/**
 * VOCABULARIO de filtros de la consola: valores del enum de la base de datos y su etiqueta. Las listas son cerradas (lista blanca):
 * un valor de la URL que no esté aquí se ignora (`parseChoice`).
 */
export const EVENT_TYPE_VALUES = ["WEDDING", "QUINCEANERA", "BAPTISM", "BIRTHDAY", "BABY_SHOWER", "KIDS", "GRADUATION", "OTHER"] as const;
export type EventTypeValue = (typeof EVENT_TYPE_VALUES)[number];

const DOMAIN_ID: Record<EventTypeValue, string> = {
  WEDDING: "wedding",
  QUINCEANERA: "quinceanera",
  BAPTISM: "baptism",
  BIRTHDAY: "birthday",
  BABY_SHOWER: "baby-shower",
  KIDS: "kids",
  GRADUATION: "graduation",
  OTHER: "other",
};

/** «Boda», «XV años»… (única fuente: `eventTypeLabel`). Un valor desconocido se devuelve tal cual. */
export const adminEventTypeLabel = (value: string): string => (value in DOMAIN_ID ? eventTypeLabel(DOMAIN_ID[value as EventTypeValue]) : value);

export const TEMPLATE_PUBLICATION_VALUES = ["PUBLISHED", "DRAFT", "ARCHIVED"] as const;
export type TemplatePublicationValue = (typeof TEMPLATE_PUBLICATION_VALUES)[number];

export const PUBLICATION_FILTER_VALUES = ["draft", "published", "changes"] as const;
export const SORT_VALUES = ["newest", "oldest"] as const;
export const EVENT_SORT_VALUES = ["newest", "oldest", "event_date"] as const;
