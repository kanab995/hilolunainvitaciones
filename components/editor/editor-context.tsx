"use client";

import { createContext, useContext } from "react";
import type { DraftApi } from "@/components/editor/use-invitation-draft";
import type { MediaController } from "@/components/editor/use-media-controller";
import type { ObjectUrlRegistry } from "@/lib/editor/local-images";
import type { ValidationErrors } from "@/lib/editor/validation";
import type { Invitation } from "@/types/invitation";
import type { InvitationTemplate } from "@/types/invitation-template";

/**
 * Lo que necesita cualquier editor de sección: el borrador (solo lectura), la API única para
 * cambiarlo, los errores de validación, la plantilla activa (solo para mostrar sus valores
 * predeterminados: el editor NO la modifica) y el registro de imágenes locales de la vista previa.
 */
export interface EditorContextValue {
  draft: Invitation;
  api: DraftApi;
  errors: ValidationErrors;
  template: InvitationTemplate;
  images: ObjectUrlRegistry;
  /** Imágenes persistentes (portada, galería, sedes guardadas): subir, quitar y estado de cada una. */
  media: MediaController;
  /** Cambia a la fila indicada (p. ej. de "Cuenta regresiva" a "Fecha"). */
  selectRow: (id: string) => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export const EditorProvider = EditorContext.Provider;

export function useEditor(): EditorContextValue {
  const value = useContext(EditorContext);
  if (!value) throw new Error("useEditor debe usarse dentro de <EditorProvider>.");
  return value;
}
