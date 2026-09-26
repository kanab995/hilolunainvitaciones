"use client";

import { Plus } from "lucide-react";
import { useEditor } from "@/components/editor/editor-context";
import { ItemCard, ItemControls } from "@/components/editor/fields/item-controls";
import { SectionHeadingFields } from "@/components/editor/fields/section-heading-fields";
import { TextField } from "@/components/editor/fields/text-field";
import type { SectionEditorProps } from "@/components/editor/section-editors/types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { newId } from "@/lib/editor/ids";
import { LIMITS } from "@/lib/editor/validation";
import type { TimelineItem } from "@/types/invitation";

const icons: readonly { value: TimelineItem["icon"]; label: string }[] = [
  { value: "ceremony", label: "Ceremonia" },
  { value: "cocktail", label: "Cóctel" },
  { value: "dinner", label: "Cena" },
  { value: "party", label: "Fiesta" },
  { value: "toast", label: "Brindis" },
  { value: "other", label: "Otro" },
];

/** Itinerario: hora, nombre e ícono de cada momento; añadir, quitar y reordenar (ids estables). */
export function TimelineEditor({ section }: SectionEditorProps) {
  const { draft, api, errors } = useEditor();
  const { timeline } = draft;
  const list = api.lists.timeline;
  if (!section) return null;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeadingFields section={section} fields={["title", "subtitle"]} />

      <ul className="flex flex-col gap-3">
        {timeline.map((item, index) => (
          <ItemCard
            key={item.id}
            controls={
              <ItemControls
                name={item.label || `momento ${index + 1}`}
                isFirst={index === 0}
                isLast={index === timeline.length - 1}
                onMoveUp={() => list.move(item.id, "up")}
                onMoveDown={() => list.move(item.id, "down")}
                onRemove={() => list.remove(item.id)}
                removeLabel="Eliminar"
              />
            }
          >
            <div className="grid gap-4 @md:grid-cols-[8rem_minmax(0,1fr)_9rem]">
              <TextField id={`tl-${item.id}-time`} label="Hora" type="time" value={item.time} error={errors[`timeline.${item.id}.time`]} onChange={(time) => list.patch(item.id, { time })} />
              <TextField id={`tl-${item.id}-label`} label="Nombre" max={LIMITS.timelineLabel} value={item.label} error={errors[`timeline.${item.id}.label`]} onChange={(label) => list.patch(item.id, { label })} />
              <Field htmlFor={`tl-${item.id}-icon`} label="Ícono">
                <Select value={item.icon} onValueChange={(icon) => list.patch(item.id, { icon: icon as TimelineItem["icon"] })}>
                  <SelectTrigger id={`tl-${item.id}-icon`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {icons.map((icon) => (
                      <SelectItem key={icon.value} value={icon.value}>
                        {icon.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </ItemCard>
        ))}
      </ul>

      <Button variant="secondary" className="self-start" onClick={() => list.add({ id: newId("tl"), time: "12:00", label: "Nuevo momento", icon: "other" })}>
        <Plus aria-hidden="true" />
        Agregar momento
      </Button>
    </div>
  );
}
