/**
 * Tipos de contenido de las páginas de marketing. Los datos viven en `lib/content/*` como arrays
 * locales tipados; la forma está pensada para poder servirse desde un backend más adelante.
 */

/** Matiz del bloque de imagen cuando aún no hay asset (usa tokens existentes; ver MediaSlot). */
export type PlaceholderTone = "cream" | "blush" | "sage" | "sand";

export interface NavItem {
  label: string;
  href: string;
}

/** Valores alineados con `EventType` y con el parámetro `category` de `/templates` (docs/ROUTES.md §5). */
export type EventCategoryId =
  | "wedding"
  | "quinceanera"
  | "baptism"
  | "birthday"
  | "baby-shower"
  | "kids"
  | "graduation"
  | "other";

export interface EventCategory {
  id: EventCategoryId;
  title: string;
  href: string;
  /** TODO(asset): replace with approved Hilo Luna asset. Sin `imageSrc` se muestra el placeholder. */
  imageSrc?: string;
  imageAlt: string;
  tone: PlaceholderTone;
}

export type HowItWorksVisualId = "template-stack" | "editor" | "share";

export interface HowItWorksStepData {
  number: string;
  title: string;
  description: string;
  visual: HowItWorksVisualId;
}

export type FeatureId =
  | "countdown"
  | "rsvp"
  | "location"
  | "gifts"
  | "gallery"
  | "music"
  | "calendar";

export interface FeatureCopy {
  id: FeatureId;
  title: string;
  description: string;
}

export interface HeroBadgeData {
  id: "countdown" | "rsvp" | "music" | "location";
  title: string;
  subtitle: string;
}
