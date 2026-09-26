"use client";

import { ImageIcon, X } from "lucide-react";
import Image from "next/image";
import { useId, useRef, useState, type DragEvent } from "react";
import type { TargetStatus } from "@/components/editor/use-media-controller";
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from "@/lib/editor/local-images";
import { cn } from "@/lib/utils";

/** Texto del estado de una subida (sin porcentajes inventados: solo se muestra el que informa el navegador). */
export function statusText(status: TargetStatus): string | undefined {
  switch (status.phase) {
    case "uploading":
      return status.progress !== undefined ? `Subiendo… ${Math.round(status.progress * 100)} %` : "Subiendo…";
    case "processing":
      return "Procesando…";
    case "saved":
      return "Guardado";
    default:
      return undefined;
  }
}

/**
 * Selector de imagen (mockup 04: zona punteada "Cambiar imagen"). Acepta JPG, PNG y WEBP por clic o
 * arrastrando; sin `capture` (en el móvil ofrece galería y cámara). Dos modos:
 *  - LOCAL (`notice`): el archivo solo se usa en la vista previa y así se dice.
 *  - GESTIONADO (`status`/`disabledReason`): el archivo se sube y se guarda de verdad; muestra el estado
 *    (Subiendo… / Procesando… / Guardado / error) o, sin almacenamiento, por qué no se puede.
 */
export function ImageDropzone({
  label,
  accessibleLabel,
  onFile,
  hint = "JPG, PNG o WEBP · máx. 10 MB",
  notice,
  status,
  disabledReason,
  className,
}: {
  label: string;
  /** Nombre accesible completo ("Cambiar imagen de portada"); por defecto, `label`. */
  accessibleLabel?: string;
  onFile: (file: File) => void;
  hint?: string;
  /** Aviso fijo bajo la zona (modo local). */
  notice?: string;
  status?: TargetStatus;
  /** Si existe, la carga está desactivada y se explica por qué. */
  disabledReason?: string;
  className?: string;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string>();

  const working = status?.phase === "uploading" || status?.phase === "processing";
  const disabled = Boolean(disabledReason) || working;
  const progressText = status ? statusText(status) : undefined;
  const shownError = error ?? (status?.phase === "error" ? status.message : undefined);

  const accept = (file: File | undefined) => {
    if (!file || disabled) return;
    const problem = validateImageFile(file);
    setError(problem);
    if (!problem) onFile(file);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    accept(event.dataTransfer.files[0]);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        aria-disabled={disabled || undefined}
        className={cn(
          "flex min-h-44 flex-col items-center justify-center gap-2 rounded-lu-card border border-dashed border-lu-border-strong bg-lu-surface-muted/60 p-5 text-center",
          "transition-colors duration-150 ease-lu-standard has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-lu-brown-600 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-lu-canvas",
          disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-lu-selected",
          over && "border-lu-brown-600 bg-lu-selected",
        )}
      >
        <span aria-hidden="true" className="inline-flex size-10 items-center justify-center rounded-lu-input bg-lu-surface-tint text-lu-brown-500">
          <ImageIcon className="size-5" strokeWidth={1.5} />
        </span>
        <span className="text-lu-sm font-medium text-lu-text">{label}</span>
        <span className="text-lu-xs text-lu-text-muted">Arrastra una imagen aquí o haz clic para seleccionar</span>
        <span className="text-lu-xs text-lu-text-subtle">{hint}</span>
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          aria-label={accessibleLabel ?? label}
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            accept(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
      {progressText ? (
        <p role="status" className={cn("text-lu-sm", status?.phase === "saved" ? "text-lu-success" : "text-lu-text-muted")}>
          {progressText}
        </p>
      ) : null}
      {disabledReason ? <p className="text-lu-xs text-lu-text-muted">{disabledReason}</p> : notice ? <p className="text-lu-xs text-lu-text-muted">{notice}</p> : null}
      {shownError ? (
        <p role="alert" className="text-lu-sm text-lu-error">
          {shownError}
        </p>
      ) : null}
    </div>
  );
}

/** Miniatura de una imagen del borrador (asset de `/public`, archivo gestionado o imagen local `blob:`) con botón de quitar opcional. */
export function ImageThumb({
  src,
  alt,
  onRemove,
  removeLabel,
  className,
}: {
  src: string;
  alt: string;
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-lu-card border border-lu-border-subtle bg-lu-surface-tint", className)}>
      <Image
        src={src}
        alt={alt}
        width={480}
        height={600}
        sizes="240px"
        unoptimized={src.startsWith("blob:") || undefined}
        className="size-full object-cover"
      />
      {onRemove ? (
        <button
          type="button"
          aria-label={removeLabel ?? "Quitar imagen"}
          onClick={onRemove}
          className="absolute top-2 right-2 inline-flex size-7 items-center after:absolute after:-inset-2 after:content-[''] justify-center rounded-full bg-lu-ink/80 text-lu-on-ink outline-none transition-colors hover:bg-lu-ink focus-visible:ring-2 focus-visible:ring-lu-brown-600 focus-visible:ring-offset-2 focus-visible:ring-offset-lu-canvas"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
