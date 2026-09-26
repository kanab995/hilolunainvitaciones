import type { Invitation, InvitationSection } from "@/types/invitation";
import type { InvitationTemplate } from "@/types/invitation-template";
import type { Personalization } from "@/types/public-rsvp";

/**
 * Props que recibe TODA sección: los datos, la plantilla (solo presentación) y su posición.
 * Una sección nunca decide qué plantilla es: lee `template.*` (layout, efectos, estilos).
 */
export interface SectionProps {
  invitation: Invitation;
  template: InvitationTemplate;
  section: InvitationSection;
  /** Posición (0-based) entre las secciones visibles; alterna fondos y orientaciones. */
  index: number;
  /** Hora del servidor (ms) como referencia inicial de la cuenta regresiva y el RSVP. */
  now: number;
  /** `id` de la siguiente sección visible (destino del botón de apertura). */
  nextSectionId?: string;
  /** Invitado identificado por `?guest=` (o `invalid`); `undefined` = invitación general. */
  personalization?: Personalization;
  /** Vista previa del EDITOR: las secciones vacías muestran un aviso discreto; en la invitación pública, nada. */
  editing?: boolean;
}
