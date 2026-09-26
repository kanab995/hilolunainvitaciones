"use client";

import { useEditor } from "@/components/editor/editor-context";
import { ImageDropzone, ImageThumb } from "@/components/editor/fields/image-dropzone";
import { TextField } from "@/components/editor/fields/text-field";
import type { ManagedPhoto } from "@/components/editor/use-media-controller";
import { LOCAL_IMAGE_NOTICE } from "@/lib/editor/local-images";
import { LIMITS } from "@/lib/editor/validation";
import type { ImageRef } from "@/types/invitation";

/**
 * Imagen opcional de una sección (portada, sede, regalos, dress code): muestra la actual (o la
 * predeterminada de la plantilla si existe), permite reemplazarla y quitarla.
 *  - Con `managed` (portada y sedes guardadas): la imagen se SUBE y se guarda de verdad; sin
 *    almacenamiento la carga se desactiva y se explica.
 *  - Sin `managed`: archivo LOCAL solo para la vista previa (las URL de objeto se revocan al sustituir o quitar).
 */
export function PhotoField({
  id,
  label,
  image,
  fallback,
  defaultAlt,
  altError,
  managed,
  subject,
  onChange,
}: {
  id: string;
  label: string;
  image: ImageRef | undefined;
  /** Imagen que se usa cuando no hay una propia (p. ej. el fondo de portada de la plantilla). */
  fallback?: { src: string; alt: string; caption: string };
  /** Texto alternativo inicial al elegir una imagen nueva. */
  defaultAlt: string;
  altError?: string;
  /** Imagen gestionada (persistente); sin ella, vista previa local. */
  managed?: ManagedPhoto;
  /** Complemento para los nombres accesibles ("portada", "la sede Parroquia…"). */
  subject?: string;
  onChange: (image: ImageRef | undefined) => void;
}) {
  const { images } = useEditor();
  const hasImage = Boolean(image?.src);
  const about = subject ? ` ${subject}` : "";

  const replace = (file: File) => {
    images.revoke(image?.src);
    onChange({ src: images.create(file), alt: image?.alt || defaultAlt });
  };

  const remove = () => {
    if (managed) return managed.onRemove();
    images.revoke(image?.src);
    onChange(undefined);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-lu-sm font-medium text-lu-text">{label}</p>
      <div className="grid gap-4 @md:grid-cols-2">
        {image?.src ? (
          <ImageThumb src={image.src} alt={image.alt} className="aspect-[4/3]" onRemove={remove} removeLabel={managed ? `Eliminar imagen${about}` : `Quitar ${label.toLowerCase()}`} />
        ) : fallback ? (
          <figure className="flex flex-col gap-1.5">
            <ImageThumb src={fallback.src} alt={fallback.alt} className="aspect-[4/3]" />
            <figcaption className="text-lu-xs text-lu-text-muted">{fallback.caption}</figcaption>
          </figure>
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center rounded-lu-card border border-lu-border-subtle bg-lu-surface-tint p-4 text-center text-lu-sm text-lu-text-muted">
            Sin imagen: se mostrará un fondo neutro.
          </div>
        )}
        {managed ? (
          <ImageDropzone
            label={hasImage ? "Cambiar imagen" : "Añadir imagen"}
            accessibleLabel={`${hasImage ? "Cambiar" : "Añadir"} imagen${about}`}
            onFile={managed.onFile}
            status={managed.status}
            disabledReason={managed.disabledReason}
          />
        ) : (
          <ImageDropzone label={hasImage ? "Cambiar imagen" : "Añadir imagen"} accessibleLabel={`${hasImage ? "Cambiar" : "Añadir"} imagen${about}`} onFile={replace} notice={LOCAL_IMAGE_NOTICE} />
        )}
      </div>
      {hasImage ? (
        <TextField
          id={`${id}-alt`}
          label="Texto alternativo"
          hint="Describe la imagen para quienes no pueden verla. Puedes dejarlo vacío si es solo decorativa."
          max={LIMITS.altText}
          optional
          value={image?.alt ?? ""}
          error={altError}
          onChange={(alt) => image && onChange({ ...image, alt })}
        />
      ) : null}
    </div>
  );
}
