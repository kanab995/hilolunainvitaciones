/** Descarga un Blob como archivo (solo navegador). El nombre ya viene saneado de `lib/share/target.ts`. */
export function downloadBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Se libera después del clic: algunos navegadores necesitan un instante para iniciar la descarga.
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
