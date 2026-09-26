import type {
  DressCode,
  DressCodeSwatch,
  FontChoice,
  ImageRef,
  InvitationClosing,
  InvitationCover,
  InvitationStory,
  RSVPSettings,
  StyleOverrides,
} from "@/types/invitation";
import { logger } from "@/server/observability/logger";

/**
 * Lectura DEFENSIVA de las columnas JSON (docs/DATABASE_SCHEMA.md §1.4). Ningún valor de la BD se
 * confía: si un campo no cumple la forma esperada se usa un valor seguro, se registra el problema en
 * el servidor y la invitación sigue dibujándose. Deuda técnica: sustituir por esquemas Zod por bloque
 * cuando se apruebe la dependencia (docs/ARCHITECTURE.md §11).
 */

export type JsonRecord = Record<string, unknown>;

export const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value);

/** Informa de un JSON inválido (solo servidor). No incluye datos del usuario más allá del contexto. */
export function reportInvalidJson(context: string, reason: string): void {
  logger.error("mapper.invalid_json", undefined, { context, reason });
}

const str = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
const num = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
const bool = (value: unknown): boolean | undefined => (typeof value === "boolean" ? value : undefined);

/** Copia solo las claves con valor (los `undefined` no se serializan ni se comparan). */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

export function parseImageRef(value: unknown): ImageRef | undefined {
  if (!isRecord(value)) return undefined;
  const alt = str(value.alt);
  if (alt === undefined) return undefined;
  return compact({ src: str(value.src), alt, width: num(value.width), height: num(value.height) });
}

/** Encabezados y ajustes de una sección (`InvitationSection.settings`). */
export interface SectionSettings {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  align?: "left" | "center" | "right";
  overlay?: boolean;
}

export function parseSectionSettings(value: unknown, context: string): SectionSettings {
  if (!isRecord(value)) {
    if (value !== undefined && value !== null) reportInvalidJson(context, "settings no es un objeto");
    return {};
  }
  const align = value.align === "left" || value.align === "center" || value.align === "right" ? value.align : undefined;
  return compact({ eyebrow: str(value.eyebrow), title: str(value.title), subtitle: str(value.subtitle), align, overlay: bool(value.overlay) });
}

export function parseCover(value: unknown, context: string): InvitationCover {
  const fallback: InvitationCover = { openLabel: "Abrir invitación" };
  if (!isRecord(value) || str(value.openLabel) === undefined) {
    if (isRecord(value) && Object.keys(value).length > 0) reportInvalidJson(context, "portada sin openLabel");
    return fallback;
  }
  return compact({ eyebrow: str(value.eyebrow), tagline: str(value.tagline), openLabel: value.openLabel as string, photo: parseImageRef(value.photo) });
}

export function parseStory(value: unknown, context: string): InvitationStory {
  if (isRecord(value) && Array.isArray(value.paragraphs)) return { paragraphs: value.paragraphs.filter((p): p is string => typeof p === "string") };
  if (isRecord(value) && Object.keys(value).length > 0) reportInvalidJson(context, "historia sin párrafos");
  return { paragraphs: [] };
}

export function parseClosing(value: unknown, context: string): InvitationClosing {
  if (isRecord(value) && str(value.message) !== undefined) return { message: value.message as string };
  if (isRecord(value) && Object.keys(value).length > 0) reportInvalidJson(context, "cierre sin mensaje");
  return { message: "" };
}

export function parseDressCode(value: unknown, context: string): DressCode | undefined {
  if (!isRecord(value) || Object.keys(value).length === 0) return undefined;
  const style = str(value.style);
  const description = str(value.description);
  if (style === undefined || description === undefined || !Array.isArray(value.palette)) {
    reportInvalidJson(context, "código de vestimenta incompleto");
    return undefined;
  }
  const palette = value.palette.flatMap((swatch): DressCodeSwatch[] => {
    if (!isRecord(swatch) || !/^#[0-9a-fA-F]{6}$/.test(str(swatch.hex) ?? "")) return [];
    return [compact({ name: str(swatch.name), hex: swatch.hex as string })];
  });
  return compact({ style, description, palette, illustration: parseImageRef(value.illustration) });
}

/** Encabezado de la mesa de regalos (`GIFTS.content`); las tiendas son filas de `GiftRegistry`. */
export interface GiftRegistryMeta {
  message: string;
  moreUrl?: string;
  photo?: ImageRef;
}

export function parseGiftRegistryMeta(value: unknown): GiftRegistryMeta {
  if (!isRecord(value)) return { message: "" };
  return compact({ message: str(value.message) ?? "", moreUrl: str(value.moreUrl), photo: parseImageRef(value.photo) });
}

const RSVP_FALLBACK: RSVPSettings = { enabled: false, message: "", maxCompanions: 0, allowMaybe: false, askDietaryNotes: false };

export function parseRsvpSettings(value: unknown, context: string): RSVPSettings {
  if (!isRecord(value) || Object.keys(value).length === 0) return RSVP_FALLBACK;
  const enabled = bool(value.enabled);
  const message = str(value.message);
  const maxCompanions = num(value.maxCompanions);
  const allowMaybe = bool(value.allowMaybe);
  const askDietaryNotes = bool(value.askDietaryNotes);
  if (enabled === undefined || message === undefined || maxCompanions === undefined || allowMaybe === undefined || askDietaryNotes === undefined) {
    reportInvalidJson(context, "ajustes de RSVP incompletos");
    return RSVP_FALLBACK;
  }
  return compact({ enabled, deadline: str(value.deadline), message, ctaLabel: str(value.ctaLabel), maxCompanions, allowMaybe, askDietaryNotes });
}

const fontChoice = (value: unknown): FontChoice | undefined => (value === "cormorant" || value === "inter" ? value : undefined);
const hexColor = (value: unknown): string | undefined => (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : undefined);

export function parseStyleOverrides(value: unknown, context: string): Readonly<Record<string, StyleOverrides>> {
  if (!isRecord(value)) {
    if (value !== undefined && value !== null) reportInvalidJson(context, "styleOverrides no es un objeto");
    return {};
  }
  const result: Record<string, StyleOverrides> = {};
  for (const [templateSlug, raw] of Object.entries(value)) {
    if (!isRecord(raw)) {
      reportInvalidJson(context, `personalización de "${templateSlug}" inválida`);
      continue;
    }
    const fonts = isRecord(raw.fonts) ? compact({ names: fontChoice(raw.fonts.names), tagline: fontChoice(raw.fonts.tagline) }) : undefined;
    result[templateSlug] = compact({ accent: hexColor(raw.accent), fonts: fonts && Object.keys(fonts).length > 0 ? fonts : undefined });
  }
  return result;
}

/** Nombres de los anfitriones: nunca vacíos ni con elementos que no sean texto. */
export function parseNames(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((name): name is string => typeof name === "string") : [];
}
