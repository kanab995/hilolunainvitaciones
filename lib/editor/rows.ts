import { isPinnedSection } from "@/lib/editor/operations";
import type { Invitation, InvitationSectionType } from "@/types/invitation";

/**
 * Filas de la lista lateral del editor (mockup 04). Casi todas son SECCIONES de la invitación
 * (`Invitation.sections`: se ocultan y reordenan); dos son grupos de DATOS que no se dibujan como
 * sección propia y por eso están fijas: "Fecha" (`event.startsAt`, alimenta portada, cuenta
 * regresiva y cierre) y "Música" (`MusicSettings`, sin reproductor todavía).
 */
export type EditorRowType = InvitationSectionType | "date" | "music";

export type EditorIconKey =
  | "cover"
  | "date"
  | "countdown"
  | "location"
  | "story"
  | "photos"
  | "timeline"
  | "gifts"
  | "rsvp"
  | "music"
  | "dressCode"
  | "closing";

export interface EditorRowMeta {
  label: string;
  subtitle: string;
  /** Texto bajo el título del panel central ("Es la primera impresión de tu invitación…"). */
  description: string;
  icon: EditorIconKey;
}

export const rowMeta: Record<EditorRowType, EditorRowMeta> = {
  hero: {
    label: "Portada",
    subtitle: "Nombres y foto principal",
    description: "Es la primera impresión de tu invitación. Personaliza los elementos que aparecerán en la portada de tu evento.",
    icon: "cover",
  },
  date: {
    label: "Fecha",
    subtitle: "Día y hora",
    description: "Elige el día y la hora de tu evento. La cuenta regresiva y la fecha de la portada se calculan a partir de aquí.",
    icon: "date",
  },
  countdown: {
    label: "Cuenta regresiva",
    subtitle: "Tiempo para el gran día",
    description: "Muestra cuánto falta para tu evento. Se calcula sola a partir de la fecha: no hay números que editar.",
    icon: "countdown",
  },
  locations: {
    label: "Ubicación",
    subtitle: "Dirección y mapa",
    description: "Indica dónde será la ceremonia y la recepción, con su dirección, hora y un enlace para llegar.",
    icon: "location",
  },
  story: {
    label: "Historia",
    subtitle: "Nuestra historia",
    description: "Cuenta a tus invitados algo de ustedes. Puedes separar el texto en párrafos con una línea en blanco.",
    icon: "story",
  },
  gallery: {
    label: "Fotos",
    subtitle: "Galería de momentos",
    description: "Las fotografías que acompañan tu invitación. Cada una lleva un texto alternativo para quienes no pueden verla.",
    icon: "photos",
  },
  timeline: {
    label: "Itinerario",
    subtitle: "Orden del evento",
    description: "Los momentos del día, en orden. Agrega, quita y reordena lo que necesites.",
    icon: "timeline",
  },
  giftRegistry: {
    label: "Regalos",
    subtitle: "Mesa de regalos",
    description: "Enlaces a tus mesas de regalos. Solo se muestran los nombres de las tiendas, sin logos.",
    icon: "gifts",
  },
  rsvp: {
    label: "RSVP",
    subtitle: "Confirmación de asistencia",
    description: "Configura cómo confirman tus invitados. En esta demo las respuestas no se guardan.",
    icon: "rsvp",
  },
  music: {
    label: "Música",
    subtitle: "Canción especial",
    description: "Prepara la canción de tu invitación. Todavía no hay reproductor: aquí solo se configura.",
    icon: "music",
  },
  dressCode: {
    label: "Dress code",
    subtitle: "Código de vestimenta",
    description: "Sugiere cómo vestir y una paleta de colores para tus invitados.",
    icon: "dressCode",
  },
  footer: {
    label: "Cierre",
    subtitle: "Mensaje final",
    description: "El mensaje con el que se despide tu invitación.",
    icon: "closing",
  },
};

export const DATE_ROW_ID = "row:date";
export const MUSIC_ROW_ID = "row:music";

export interface EditorRow extends EditorRowMeta {
  /** Id de la sección (`InvitationSection.id`) o `row:date` / `row:music`. */
  id: string;
  type: EditorRowType;
  /** Es una sección de la invitación (se oculta y, si no está fija, se reordena). */
  isSection: boolean;
  /** No se puede arrastrar ni mover (portada, cierre y los grupos de datos). */
  pinned: boolean;
  /** Solo secciones: si se dibuja en la invitación. */
  visible?: boolean;
}

/** Portada · Fecha · (secciones en el orden del borrador) · Música. */
export function buildEditorRows(draft: Invitation): EditorRow[] {
  const sectionRows = draft.sections.map<EditorRow>((section) => ({
    ...rowMeta[section.type],
    id: section.id,
    type: section.type,
    isSection: true,
    pinned: isPinnedSection(section),
    visible: section.isVisible,
  }));
  const dateRow: EditorRow = { ...rowMeta.date, id: DATE_ROW_ID, type: "date", isSection: false, pinned: true };
  const musicRow: EditorRow = { ...rowMeta.music, id: MUSIC_ROW_ID, type: "music", isSection: false, pinned: true };

  const heroIndex = sectionRows.findIndex((row) => row.type === "hero");
  const rows = [...sectionRows];
  rows.splice(heroIndex + 1, 0, dateRow);
  rows.push(musicRow);
  return rows;
}
