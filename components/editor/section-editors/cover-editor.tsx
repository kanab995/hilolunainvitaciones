"use client";

import { useEditor } from "@/components/editor/editor-context";
import { OptionCardGroup, type OptionCard } from "@/components/editor/fields/option-card-group";
import { PhotoField } from "@/components/editor/fields/photo-field";
import { TextField } from "@/components/editor/fields/text-field";
import type { SectionEditorProps } from "@/components/editor/section-editors/types";
import { Field } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { fontChoiceLabels } from "@/lib/invitation/fonts";
import { LIMITS } from "@/lib/editor/validation";
import type { FontChoice, Invitation } from "@/types/invitation";

type Align = "left" | "center" | "right";

/** Mini ilustración de la alineación (bloque + líneas), como en el mockup 04. */
function AlignIllustration({ align }: { align: Align }) {
  const side = align === "left" ? "items-start" : align === "right" ? "items-end" : "items-center";
  return (
    <span className={`flex h-14 w-full flex-col justify-center gap-1.5 px-3 ${side}`}>
      <span className="h-4 w-8 rounded-sm bg-lu-border-strong/70" />
      <span className="h-1 w-12 rounded-full bg-lu-border-strong" />
      <span className="h-1 w-8 rounded-full bg-lu-border-strong" />
    </span>
  );
}

const alignOptions: readonly OptionCard<Align>[] = [
  { value: "left", label: "Izquierda", illustration: <AlignIllustration align="left" /> },
  { value: "center", label: "Centrada", illustration: <AlignIllustration align="center" /> },
  { value: "right", label: "Derecha", illustration: <AlignIllustration align="right" /> },
];

/** Solo las fuentes aprobadas (docs/ASSET_LICENSES.md §3). Playfair Display y Montserrat siguen pendientes: no se ofrecen. */
const fontOptions: readonly FontChoice[] = ["cormorant", "inter"];

/** Portada (mockup 04): frase, nombres, imagen, alineación, estilo de texto y velo. */
export function CoverEditor({ section }: SectionEditorProps) {
  const { draft, api, errors, template, media } = useEditor();
  if (!section) return null;

  const { cover } = draft;
  const backdrop = template.decor.heroBackdrop;
  const overrides = draft.styleOverrides?.[template.slug];

  const setName = (index: number, value: string) =>
    api.updateInvitation((d) => {
      const names = [...d.names];
      while (names.length <= index) names.push("");
      names[index] = value;
      while (names.length > 1 && names[names.length - 1] === "") names.pop();
      return { names };
    });

  const patchCover = (patch: Partial<Invitation["cover"]>) => api.updateInvitation((d) => ({ cover: { ...d.cover, ...patch } }));

  const setFont = (target: "names" | "tagline", choice: FontChoice) =>
    api.updateInvitation((d) => {
      const current = d.styleOverrides?.[template.slug];
      return {
        styleOverrides: { ...d.styleOverrides, [template.slug]: { ...current, fonts: { ...current?.fonts, [target]: choice } } },
      };
    });

  return (
    <div className="flex flex-col gap-6">
      <TextField
        id="cover-eyebrow"
        label="Título / frase principal"
        tone="serif"
        max={LIMITS.eyebrow}
        optional
        value={cover.eyebrow ?? ""}
        error={errors["cover.eyebrow"]}
        onChange={(eyebrow) => patchCover({ eyebrow })}
      />

      <div className="grid gap-4 @md:grid-cols-2">
        <TextField id="cover-name-1" label="Nombre 1" tone="serif" max={LIMITS.name} value={draft.names[0] ?? ""} error={errors["names.0"]} onChange={(value) => setName(0, value)} />
        <TextField id="cover-name-2" label="Nombre 2" tone="serif" max={LIMITS.name} optional value={draft.names[1] ?? ""} error={errors["names.1"]} onChange={(value) => setName(1, value)} />
      </div>

      <TextField
        id="cover-tagline"
        label="Frase bajo los nombres"
        max={LIMITS.tagline}
        optional
        value={cover.tagline ?? ""}
        error={errors["cover.tagline"]}
        onChange={(tagline) => patchCover({ tagline })}
      />

      <PhotoField
        id="cover-photo"
        label="Imagen de portada"
        image={cover.photo}
        fallback={
          backdrop?.kind === "image"
            ? { src: backdrop.src, alt: `Imagen predeterminada de ${template.name}`, caption: `Imagen predeterminada de ${template.name}` }
            : undefined
        }
        defaultAlt="Foto de portada"
        managed={media.cover}
        subject="de portada"
        altError={errors["cover.photo.alt"]}
        onChange={(photo) => patchCover({ photo })}
      />

      <OptionCardGroup name="cover-align" legend="Alineación del contenido" value={section.align ?? "center"} options={alignOptions} onChange={(align) => api.updateSection(section.id, { align })} />

      <div className="flex flex-col gap-3">
        <p className="text-lu-sm font-medium text-lu-text">Estilo de texto</p>
        <div className="grid gap-4 rounded-lu-card bg-lu-surface-tint/60 p-4 @md:grid-cols-2">
          <Field htmlFor="cover-font-names" label="Nombres">
            <Select value={overrides?.fonts?.names ?? "cormorant"} onValueChange={(value) => setFont("names", value as FontChoice)}>
              <SelectTrigger id="cover-font-names">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fontOptions.map((choice) => (
                  <SelectItem key={choice} value={choice}>
                    {fontChoiceLabels[choice]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field htmlFor="cover-font-tagline" label="Frase principal">
            <Select value={overrides?.fonts?.tagline ?? "inter"} onValueChange={(value) => setFont("tagline", value as FontChoice)}>
              <SelectTrigger id="cover-font-tagline">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fontOptions.map((choice) => (
                  <SelectItem key={choice} value={choice}>
                    {fontChoiceLabels[choice]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <p className="text-lu-xs text-lu-text-muted">Solo están disponibles las fuentes aprobadas. Habrá más cuando se incorporen.</p>
      </div>

      <div className="flex items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <label htmlFor="cover-overlay" className="text-lu-sm font-medium text-lu-text">
            Overlay en imagen
          </label>
          <p id="cover-overlay-hint" className="max-w-xs text-lu-sm text-lu-text-muted">
            Agregar un velo para mejorar la legibilidad del texto.
          </p>
        </div>
        <Switch id="cover-overlay" aria-describedby="cover-overlay-hint" checked={section.overlay ?? false} onCheckedChange={(overlay) => api.updateSection(section.id, { overlay })} />
      </div>
    </div>
  );
}
