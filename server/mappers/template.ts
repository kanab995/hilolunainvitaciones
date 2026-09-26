import type { Template as TemplateRow, TemplatePublicationStatus } from "@prisma/client";
import { designStatusFromDb, designStatusToDb, eventTypeFromDb, eventTypeToDb, templateFeatureFromDb, templateFeatureToDb, templateStyleFromDb, templateStyleToDb } from "@/server/mappers/enums";
import { isRecord, reportInvalidJson } from "@/server/mappers/json";
import type { InvitationSample, Template, TemplateScreen, TemplateScreenId } from "@/types/templates";
import type { PlaceholderTone } from "@/types/marketing";

/**
 * Mappers del catálogo de plantillas (fila de BD ↔ `Template` del dominio). La fila guarda solo
 * metadatos del catálogo: el TEMA visual vive en código y jamás en la BD ni en estos objetos.
 * `designStatus` (madurez del diseño) y `publicationStatus` (visibilidad en el catálogo) son
 * conceptos independientes: el dominio `Template.status` es el primero; el segundo solo filtra consultas.
 */

export type TemplateRowData = Pick<
  TemplateRow,
  | "id"
  | "slug"
  | "name"
  | "eventType"
  | "style"
  | "secondaryStyles"
  | "description"
  | "premium"
  | "minimumPlan"
  | "designStatus"
  | "publicationStatus"
  | "features"
  | "thumbnailSrc"
  | "thumbnailAlt"
  | "thumbnailTone"
  | "previewSample"
  | "previewScreens"
  | "sortOrder"
>;

const TONES: readonly PlaceholderTone[] = ["cream", "blush", "sage", "sand"];
const SCREEN_IDS: readonly TemplateScreenId[] = ["cover", "story", "details", "gallery"];

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

function parseSample(value: unknown, fallbackName: string, context: string): InvitationSample {
  if (isRecord(value) && typeof value.eyebrow === "string" && typeof value.date === "string" && typeof value.button === "string") {
    return { eyebrow: value.eyebrow, names: strings(value.names), date: value.date, venue: strings(value.venue), button: value.button };
  }
  reportInvalidJson(context, "invitación de muestra inválida");
  return { eyebrow: "", names: [fallbackName], date: "", venue: [], button: "" };
}

function parseScreens(value: unknown, context: string): TemplateScreen[] {
  if (!Array.isArray(value)) {
    reportInvalidJson(context, "pantallas inválidas");
    return [];
  }
  return value.flatMap((screen): TemplateScreen[] =>
    isRecord(screen) && typeof screen.label === "string" && SCREEN_IDS.includes(screen.id as TemplateScreenId) ? [{ id: screen.id as TemplateScreenId, label: screen.label }] : [],
  );
}

export function dbTemplateToDomain(row: TemplateRowData): Template {
  const context = `Template(${row.slug})`;
  const tone = TONES.includes(row.thumbnailTone as PlaceholderTone) ? (row.thumbnailTone as PlaceholderTone) : "cream";
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: designStatusFromDb[row.designStatus],
    eventType: eventTypeFromDb[row.eventType],
    style: templateStyleFromDb[row.style],
    ...(row.secondaryStyles.length > 0 ? { secondaryStyles: row.secondaryStyles.map((style) => templateStyleFromDb[style]) } : {}),
    thumbnail: { ...(row.thumbnailSrc ? { src: row.thumbnailSrc } : {}), alt: row.thumbnailAlt, tone },
    description: row.description,
    premium: row.premium,
    minimumPlan: row.minimumPlan,
    features: row.features.map((feature) => templateFeatureFromDb[feature]),
    preview: { sample: parseSample(row.previewSample, row.name, context), screens: parseScreens(row.previewScreens, context) },
  };
}

/** Plantilla del catálogo → fila de BD. `publicationStatus` es independiente de `template.status`. */
export function domainTemplateToDb(template: Template, options: { sortOrder: number; publicationStatus: TemplatePublicationStatus }): TemplateRowData {
  return {
    id: template.id,
    slug: template.slug,
    name: template.name,
    eventType: eventTypeToDb[template.eventType],
    style: templateStyleToDb[template.style],
    secondaryStyles: (template.secondaryStyles ?? []).map((style) => templateStyleToDb[style]),
    description: template.description,
    premium: template.premium,
    minimumPlan: template.minimumPlan,
    designStatus: designStatusToDb[template.status],
    publicationStatus: options.publicationStatus,
    features: template.features.map((feature) => templateFeatureToDb[feature]),
    thumbnailSrc: template.thumbnail.src ?? null,
    thumbnailAlt: template.thumbnail.alt,
    thumbnailTone: template.thumbnail.tone,
    previewSample: template.preview.sample as unknown as TemplateRowData["previewSample"],
    previewScreens: template.preview.screens as unknown as TemplateRowData["previewScreens"],
    sortOrder: options.sortOrder,
  };
}
