import type { InvitationSection } from "@/types/invitation";

/** Props de cualquier editor de sección. `section` es `undefined` en las filas de datos (Fecha, Música). */
export interface SectionEditorProps {
  section?: InvitationSection;
}
