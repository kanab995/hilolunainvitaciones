"use client";

import { useEditor } from "@/components/editor/editor-context";
import { SectionHeadingFields } from "@/components/editor/fields/section-heading-fields";
import { TextAreaField } from "@/components/editor/fields/text-field";
import type { SectionEditorProps } from "@/components/editor/section-editors/types";
import { LIMITS } from "@/lib/editor/validation";

/**
 * Historia: título y texto. Los párrafos se separan con una línea en blanco y se guardan como una
 * lista (`story.paragraphs`). Es texto plano: la invitación lo pinta como texto, nunca como HTML.
 */
export function StoryEditor({ section }: SectionEditorProps) {
  const { draft, api, errors } = useEditor();
  if (!section) return null;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeadingFields section={section} fields={["title"]} />
      <TextAreaField
        id="story-text"
        label="Texto"
        className="[&_textarea]:min-h-56"
        max={LIMITS.storyText}
        hint="Separa los párrafos con una línea en blanco."
        value={draft.story.paragraphs.join("\n\n")}
        error={errors["story.text"]}
        onChange={(value) => api.updateInvitation({ story: { paragraphs: value.split(/\n{2,}/) } })}
      />
    </div>
  );
}
