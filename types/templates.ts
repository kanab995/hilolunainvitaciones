import type { PlanId } from "@/lib/billing/plans";
import type { EventCategoryId, FeatureId, PlaceholderTone } from "@/types/marketing";

/**
 * Catálogo de plantillas (mockup 02, docs/PROJECT_SPEC.md §5). Forma pensada para poder servirse
 * desde la base de datos más adelante (`Template` en docs/DATABASE_SCHEMA.md): por ahora los datos
 * viven en `lib/content/templates.ts` (fuente del seed); las páginas del catálogo los leen de la BD.
 */

/** Estilo visual de una plantilla. Es el valor del parámetro `style` de `/templates` (docs/ROUTES.md §5). */
export type TemplateStyleId =
  | "floral"
  | "romantic"
  | "minimal"
  | "elegant"
  | "rustic"
  | "modern"
  | "destination"
  | "themed"
  | "kids";

/** Imagen de la tarjeta de galería. */
export interface TemplateThumbnail {
  /** TODO(asset): replace with approved Hilo Luna asset. Sin `src` se muestra el placeholder. */
  src?: string;
  alt: string;
  /** Matiz del placeholder mientras no haya imagen. */
  tone: PlaceholderTone;
}

/** Pantalla de la invitación que se muestra en la vista previa y como miniatura ([03]). */
export type TemplateScreenId = "cover" | "story" | "details" | "gallery";

export interface TemplateScreen {
  id: TemplateScreenId;
  /** Nombre de la sección ("Portada"); rotula la miniatura. */
  label: string;
}

/** Texto de ejemplo con el que se dibuja la invitación de muestra de una plantilla. */
export interface InvitationSample {
  eyebrow: string;
  /** Una línea por elemento ("Andrea", "&", "Fernando"). */
  names: readonly string[];
  date: string;
  venue: readonly string[];
  button: string;
}

/** Funciones que una plantilla incluye y se listan en el detalle. */
export type TemplateFeatureId = Extract<FeatureId, "music" | "rsvp" | "gallery" | "countdown" | "location" | "gifts">;

/**
 * Madurez de una plantilla del catálogo (docs/ARCHITECTURE.md §4.9, docs/PROJECT_SPEC.md §5):
 *  - `implemented`: diseño aprobado y renderizable; tiene demo pública y se puede usar.
 *  - `concept`: existe un tema provisional en el motor, pero su invitación completa NO está diseñada.
 *  - `comingSoon`: solo existe la tarjeta de galería; sin tema en el motor, sin demo.
 * No es el estado de publicación de BD (`TemplateStatus` DRAFT/PUBLISHED de DATABASE_SCHEMA).
 */
export type TemplateStatus = "implemented" | "concept" | "comingSoon";

export interface Template {
  id: string;
  /** Identificador de URL: `/templates/[slug]`. */
  slug: string;
  name: string;
  status: TemplateStatus;
  /** Tipo de evento (mismo vocabulario que `EventType` y que el parámetro `category`). */
  eventType: EventCategoryId;
  /** Estilo principal (filtro y tarjeta). */
  style: TemplateStyleId;
  /** Estilos adicionales que se muestran en el detalle ("Boda · Floral · Romántica"). */
  secondaryStyles?: readonly TemplateStyleId[];
  thumbnail: TemplateThumbnail;
  description: string;
  premium: boolean;
  /**
   * Plan mínimo para USAR la plantilla (D-31). Independiente de `status` (madurez del diseño) y de la publicación en el
   * catálogo. La comprueba el servidor al crear un evento o cambiar de plantilla. Magnolia: `FREE`.
   */
  minimumPlan: PlanId;
  /** Funciones incluidas (orden de aparición en el detalle). */
  features: readonly TemplateFeatureId[];
  /** Vista previa del detalle: invitación de muestra y pantallas para las miniaturas. */
  preview: {
    sample: InvitationSample;
    screens: readonly TemplateScreen[];
  };
}

/** Filtros activos de la galería. `null` = sin filtrar ("Todas" / "Todos los estilos"). */
export interface TemplateFilterState {
  category: EventCategoryId | null;
  style: TemplateStyleId | null;
}

/** Chip de categoría de la galería [02]. */
export interface TemplateCategoryFilter {
  id: EventCategoryId;
  label: string;
  /** Tipos de evento que agrupa el chip. */
  eventTypes: readonly EventCategoryId[];
  /** Estilos que el chip incluye además (p. ej. "Infantil" incluye el estilo infantil). */
  styles?: readonly TemplateStyleId[];
}
