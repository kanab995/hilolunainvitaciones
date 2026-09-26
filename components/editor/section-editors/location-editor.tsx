"use client";

import { Plus } from "lucide-react";
import { useEditor } from "@/components/editor/editor-context";
import { ItemCard, ItemControls } from "@/components/editor/fields/item-controls";
import { PhotoField } from "@/components/editor/fields/photo-field";
import { TextAreaField, TextField } from "@/components/editor/fields/text-field";
import type { SectionEditorProps } from "@/components/editor/section-editors/types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { newId } from "@/lib/editor/ids";
import { LIMITS } from "@/lib/editor/validation";
import { invitationCopy } from "@/lib/invitation/copy";
import type { EventLocation } from "@/types/invitation";

const kinds: readonly EventLocation["kind"][] = ["ceremony", "reception", "other"];

/** Ubicación: una lista de sedes (ceremonia, recepción…). Solo enlaces: no se integra ninguna API de mapas. */
export function LocationEditor({ section }: SectionEditorProps) {
  const { draft, api, errors, images, media } = useEditor();
  const { locations } = draft;
  const list = api.lists.locations;
  if (!section) return null;

  const remove = (location: EventLocation) => {
    images.revoke(location.photo?.src);
    list.remove(location.id);
  };

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-4">
        {locations.map((location, index) => {
          const key = (field: string) => errors[`locations.${location.id}.${field}`];
          const label = location.name || invitationCopy.locationKind[location.kind];
          return (
            <ItemCard
              key={location.id}
              controls={
                <ItemControls
                  name={label}
                  isFirst={index === 0}
                  isLast={index === locations.length - 1}
                  onMoveUp={() => list.move(location.id, "up")}
                  onMoveDown={() => list.move(location.id, "down")}
                  onRemove={locations.length > 1 ? () => remove(location) : undefined}
                  removeLabel="Eliminar sede"
                />
              }
            >
              <div className="flex flex-col gap-4">
                <Field htmlFor={`loc-${location.id}-kind`} label="Tipo">
                  <Select value={location.kind} onValueChange={(kind) => list.patch(location.id, { kind: kind as EventLocation["kind"] })}>
                    <SelectTrigger id={`loc-${location.id}-kind`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {kinds.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {invitationCopy.locationKind[kind]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <TextField id={`loc-${location.id}-name`} label="Nombre del lugar" tone="serif" max={LIMITS.locationName} value={location.name} error={key("name")} onChange={(name) => list.patch(location.id, { name })} />
                <TextAreaField
                  id={`loc-${location.id}-address`}
                  label="Dirección"
                  className="[&_textarea]:min-h-20"
                  max={LIMITS.address}
                  hint="Una línea por renglón."
                  value={location.addressLines.join("\n")}
                  error={key("address")}
                  onChange={(value) => list.patch(location.id, { addressLines: value.split("\n") })}
                />
                <div className="grid gap-4 @md:grid-cols-2">
                  <TextField id={`loc-${location.id}-time`} label="Hora" placeholder="17:00 hrs" max={LIMITS.locationTime} optional value={location.time ?? ""} error={key("time")} onChange={(time) => list.patch(location.id, { time })} />
                  <TextField
                    id={`loc-${location.id}-map`}
                    label="Enlace del mapa"
                    type="url"
                    inputMode="url"
                    placeholder="https://"
                    optional
                    value={location.mapUrl ?? ""}
                    error={key("mapUrl")}
                    onChange={(mapUrl) => list.patch(location.id, { mapUrl })}
                  />
                </div>
                <PhotoField
                  id={`loc-${location.id}-photo`}
                  label="Imagen del lugar"
                  image={location.photo}
                  defaultAlt={`Imagen de ${label}`}
                  managed={media.location(location.id)}
                  subject={`de la sede ${label}`}
                  altError={key("photo.alt")}
                  onChange={(photo) => list.patch(location.id, { photo })}
                />
              </div>
            </ItemCard>
          );
        })}
      </ul>
      <Button
        variant="secondary"
        className="self-start"
        onClick={() => list.add({ id: newId("loc"), kind: "other", name: "Nueva sede", addressLines: [""] })}
      >
        <Plus aria-hidden="true" />
        Agregar sede
      </Button>
    </div>
  );
}
