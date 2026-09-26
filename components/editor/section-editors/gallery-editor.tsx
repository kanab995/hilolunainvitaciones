"use client";

import { useEditor } from "@/components/editor/editor-context";
import { ImageDropzone, ImageThumb, statusText } from "@/components/editor/fields/image-dropzone";
import { ItemCard, ItemControls } from "@/components/editor/fields/item-controls";
import { SectionHeadingFields } from "@/components/editor/fields/section-heading-fields";
import { TextField } from "@/components/editor/fields/text-field";
import type { SectionEditorProps } from "@/components/editor/section-editors/types";
import { LIMITS } from "@/lib/editor/validation";

/**
 * Fotos (galería): miniatura, texto alternativo, reordenar y eliminar. Las imágenes nuevas se SUBEN y se
 * guardan de verdad (archivo + fila de galería); quitar una borra su archivo si nada más lo usa. El texto
 * alternativo y el orden se guardan con el autoguardado. Sin almacenamiento configurado la carga se
 * desactiva con un mensaje (no se finge que se guardó).
 */
export function GalleryEditor({ section }: SectionEditorProps) {
  const { draft, api, errors, media } = useEditor();
  const { gallery } = draft;
  const list = api.lists.gallery;
  if (!section) return null;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeadingFields section={section} fields={["eyebrow", "title", "subtitle"]} />

      {gallery.length === 0 ? (
        <p className="rounded-lu-card border border-dashed border-lu-border-strong p-6 text-center text-lu-sm text-lu-text-muted">
          Todavía no hay fotos. La sección se mostrará sin imágenes.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {gallery.map((image, index) => {
            const removal = media.gallery.removeStatus(image.id);
            return (
              <ItemCard
                key={image.id}
                controls={
                  <ItemControls
                    name={`foto ${index + 1} de la galería`}
                    isFirst={index === 0}
                    isLast={index === gallery.length - 1}
                    onMoveUp={() => list.move(image.id, "up")}
                    onMoveDown={() => list.move(image.id, "down")}
                    removeLabel="Eliminar"
                    onRemove={removal.phase === "processing" ? undefined : () => media.gallery.remove(image.id)}
                  />
                }
              >
                <div className="flex gap-4">
                  {image.src ? <ImageThumb src={image.src} alt="" className="h-24 w-20 shrink-0" /> : <div aria-hidden="true" className="h-24 w-20 shrink-0 rounded-lu-card bg-lu-surface-tint" />}
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <TextField
                      id={`gal-${image.id}-alt`}
                      label="Texto alternativo"
                      max={LIMITS.altText}
                      optional
                      value={image.alt}
                      error={errors[`gallery.${image.id}.alt`]}
                      onChange={(alt) => list.patch(image.id, { alt })}
                    />
                    {removal.phase === "processing" ? (
                      <p role="status" className="text-lu-xs text-lu-text-muted">
                        {statusText(removal)}
                      </p>
                    ) : null}
                    {removal.phase === "error" ? (
                      <p role="alert" className="text-lu-sm text-lu-error">
                        {removal.message}
                      </p>
                    ) : null}
                  </div>
                </div>
              </ItemCard>
            );
          })}
        </ul>
      )}

      <ImageDropzone label="Agregar imagen" accessibleLabel="Agregar imagen a la galería" onFile={media.gallery.add} status={media.gallery.status} disabledReason={media.gallery.disabledReason} />
    </div>
  );
}
