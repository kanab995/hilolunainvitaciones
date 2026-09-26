"use client";

import { TextField } from "@/components/editor/fields/text-field";
import { useEditor } from "@/components/editor/editor-context";
import { LIMITS } from "@/lib/editor/validation";
import type { InvitationSection } from "@/types/invitation";

/**
 * Encabezado editable de una sección (`InvitationSection.eyebrow/title/subtitle`), común a todas.
 * La palabra en cursiva se marca con asteriscos ("Nuestra *historia*").
 */
export function SectionHeadingFields({
  section,
  fields = ["title"],
}: {
  section: InvitationSection;
  /** Qué campos de encabezado tiene sentido editar en esta sección. */
  fields?: readonly ("eyebrow" | "title" | "subtitle")[];
}) {
  const { api, errors } = useEditor();
  const key = (field: string) => `sections.${section.id}.${field}`;

  return (
    <div className="flex flex-col gap-4">
      {fields.includes("eyebrow") ? (
        <TextField
          id={`${section.id}-eyebrow`}
          label="Etiqueta superior"
          optional
          max={LIMITS.sectionEyebrow}
          value={section.eyebrow ?? ""}
          error={errors[key("eyebrow")]}
          onChange={(eyebrow) => api.updateSection(section.id, { eyebrow })}
        />
      ) : null}
      {fields.includes("title") ? (
        <TextField
          id={`${section.id}-title`}
          label="Título"
          optional
          max={LIMITS.sectionTitle}
          hint="Marca una palabra en cursiva con asteriscos: Nuestra *historia*."
          value={section.title ?? ""}
          error={errors[key("title")]}
          onChange={(title) => api.updateSection(section.id, { title })}
        />
      ) : null}
      {fields.includes("subtitle") ? (
        <TextField
          id={`${section.id}-subtitle`}
          label="Subtítulo"
          optional
          max={LIMITS.sectionSubtitle}
          value={section.subtitle ?? ""}
          error={errors[key("subtitle")]}
          onChange={(subtitle) => api.updateSection(section.id, { subtitle })}
        />
      ) : null}
    </div>
  );
}
