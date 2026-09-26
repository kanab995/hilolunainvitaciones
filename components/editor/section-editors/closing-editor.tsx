"use client";

import { useEditor } from "@/components/editor/editor-context";
import { TextAreaField } from "@/components/editor/fields/text-field";
import type { SectionEditorProps } from "@/components/editor/section-editors/types";
import { LIMITS } from "@/lib/editor/validation";

/** Cierre: el mensaje final. Los nombres y la fecha que lo acompañan salen de los datos de la portada y la fecha. */
export function ClosingEditor({ section }: SectionEditorProps) {
  const { draft, api, errors } = useEditor();
  if (!section) return null;

  return (
    <TextAreaField
      id="closing-message"
      label="Mensaje final"
      className="[&_textarea]:min-h-24"
      max={LIMITS.closing}
      value={draft.closing.message}
      error={errors["closing.message"]}
      onChange={(message) => api.updateInvitation({ closing: { message } })}
    />
  );
}
