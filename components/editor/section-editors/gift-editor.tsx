"use client";

import { Plus } from "lucide-react";
import { useEditor } from "@/components/editor/editor-context";
import { ItemCard, ItemControls } from "@/components/editor/fields/item-controls";
import { SectionHeadingFields } from "@/components/editor/fields/section-heading-fields";
import { TextAreaField, TextField } from "@/components/editor/fields/text-field";
import type { SectionEditorProps } from "@/components/editor/section-editors/types";
import { Button } from "@/components/ui/button";
import { newId } from "@/lib/editor/ids";
import { LIMITS } from "@/lib/editor/validation";

/**
 * Regalos: mensaje, tiendas (nombre + enlace) y "Ver más opciones". Se trabaja con la API actual
 * (`giftRegistry`, singular). Solo nombres: nunca logos de terceros. Las URL se validan sin Zod.
 */
export function GiftEditor({ section }: SectionEditorProps) {
  const { draft, api, errors } = useEditor();
  const registry = draft.giftRegistry;
  const list = api.lists.giftEntries;
  if (!section) return null;

  if (!registry) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-lu-sm text-lu-text-muted">Todavía no tienes una mesa de regalos.</p>
        <Button variant="secondary" onClick={() => api.updateInvitation({ giftRegistry: { message: "", entries: [] } })}>
          <Plus aria-hidden="true" />
          Agregar mesa de regalos
        </Button>
      </div>
    );
  }

  const patchRegistry = (patch: Partial<typeof registry>) => api.updateInvitation((d) => (d.giftRegistry ? { giftRegistry: { ...d.giftRegistry, ...patch } } : {}));

  return (
    <div className="flex flex-col gap-6">
      <SectionHeadingFields section={section} fields={["eyebrow", "title"]} />

      <TextAreaField
        id="gift-message"
        label="Mensaje"
        className="[&_textarea]:min-h-24"
        max={LIMITS.giftMessage}
        value={registry.message}
        error={errors["giftRegistry.message"]}
        onChange={(message) => patchRegistry({ message })}
      />

      <div className="flex flex-col gap-3">
        <p className="text-lu-sm font-medium text-lu-text">Tiendas</p>
        <ul className="flex flex-col gap-3">
          {registry.entries.map((entry, index) => (
            <ItemCard
              key={entry.id}
              controls={
                <ItemControls
                  name={entry.name || `tienda ${index + 1}`}
                  isFirst={index === 0}
                  isLast={index === registry.entries.length - 1}
                  onMoveUp={() => list.move(entry.id, "up")}
                  onMoveDown={() => list.move(entry.id, "down")}
                  onRemove={() => list.remove(entry.id)}
                  removeLabel="Eliminar"
                />
              }
            >
              <div className="grid gap-4 @md:grid-cols-2">
                <TextField id={`gift-${entry.id}-name`} label="Nombre" max={LIMITS.giftName} value={entry.name} error={errors[`giftRegistry.${entry.id}.name`]} onChange={(name) => list.patch(entry.id, { name })} />
                <TextField
                  id={`gift-${entry.id}-url`}
                  label="Enlace"
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  value={entry.url}
                  error={errors[`giftRegistry.${entry.id}.url`]}
                  onChange={(url) => list.patch(entry.id, { url })}
                />
              </div>
            </ItemCard>
          ))}
        </ul>
        <Button variant="secondary" className="self-start" onClick={() => list.add({ id: newId("gift"), name: "", url: "" })}>
          <Plus aria-hidden="true" />
          Agregar tienda
        </Button>
      </div>

      <TextField
        id="gift-more"
        label="Enlace de «Ver más opciones»"
        type="url"
        inputMode="url"
        placeholder="https://"
        optional
        value={registry.moreUrl ?? ""}
        error={errors["giftRegistry.moreUrl"]}
        onChange={(moreUrl) => patchRegistry({ moreUrl })}
      />
    </div>
  );
}
