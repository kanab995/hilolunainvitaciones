"use client";

import { useEditor } from "@/components/editor/editor-context";
import { PhotoField } from "@/components/editor/fields/photo-field";
import { SectionHeadingFields } from "@/components/editor/fields/section-heading-fields";
import { TextAreaField, TextField } from "@/components/editor/fields/text-field";
import type { SectionEditorProps } from "@/components/editor/section-editors/types";
import { LIMITS } from "@/lib/editor/validation";
import type { DressCode } from "@/types/invitation";

/** Dress code: estilo, descripción, ilustración y paleta sugerida (los colores son decorativos y llevan nombre). */
export function DressCodeEditor({ section }: SectionEditorProps) {
  const { draft, api, errors } = useEditor();
  const dressCode = draft.dressCode;
  if (!section) return null;

  if (!dressCode) {
    return <p className="text-lu-sm text-lu-text-muted">Esta invitación no tiene código de vestimenta.</p>;
  }

  const patch = (change: Partial<DressCode>) => api.updateInvitation((d) => (d.dressCode ? { dressCode: { ...d.dressCode, ...change } } : {}));
  const patchSwatch = (index: number, change: Partial<DressCode["palette"][number]>) =>
    api.updateInvitation((d) => (d.dressCode ? { dressCode: { ...d.dressCode, palette: d.dressCode.palette.map((swatch, i) => (i === index ? { ...swatch, ...change } : swatch)) } } : {}));

  return (
    <div className="flex flex-col gap-6">
      <SectionHeadingFields section={section} fields={["eyebrow", "title"]} />
      <TextField id="dress-style" label="Estilo" tone="serif" max={LIMITS.dressStyle} value={dressCode.style} error={errors["dressCode.style"]} onChange={(style) => patch({ style })} />
      <TextAreaField id="dress-description" label="Descripción" className="[&_textarea]:min-h-24" max={LIMITS.dressDescription} value={dressCode.description} error={errors["dressCode.description"]} onChange={(description) => patch({ description })} />

      <div className="flex flex-col gap-3">
        <p className="text-lu-sm font-medium text-lu-text">Paleta sugerida</p>
        <ul className="grid gap-3 @md:grid-cols-2">
          {dressCode.palette.map((swatch, index) => (
            <li key={index} className="flex items-end gap-3">
              <span aria-hidden="true" className="mb-1.5 size-9 shrink-0 rounded-full border border-lu-border" style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(swatch.hex) ? swatch.hex : "transparent" }} />
              <TextField id={`dress-swatch-${index}-name`} label={`Color ${index + 1}`} value={swatch.name ?? ""} className="min-w-0 flex-1" onChange={(name) => patchSwatch(index, { name })} />
              <TextField id={`dress-swatch-${index}-hex`} label="Código" className="w-28 shrink-0" value={swatch.hex} error={errors[`dressCode.palette.${index}`]} onChange={(hex) => patchSwatch(index, { hex })} />
            </li>
          ))}
        </ul>
      </div>

      <PhotoField id="dress-illustration" label="Ilustración" image={dressCode.illustration} defaultAlt="Ilustración del código de vestimenta" onChange={(illustration) => patch({ illustration })} />
    </div>
  );
}
