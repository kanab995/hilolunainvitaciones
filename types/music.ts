/** Biblioteca musical (D-46): lo que el EDITOR recibe del servidor. Sin claves de almacenamiento ni documentación de licencias. */
export interface LibraryCategoryDto {
  slug: string;
  name: string;
}

export interface LibraryTrackDto {
  id: string;
  title: string;
  author: string;
  categorySlug: string;
  durationSec: number;
  /** URL pública del MP3 (muestra en el editor y vista previa). */
  audioUrl: string;
  /** Crédito que la licencia exige mostrar en la invitación. */
  attribution?: string;
}

export interface EditorMusicLibrary {
  /** El plan del evento incluye la biblioteca (Esencial y Premium). */
  allowed: boolean;
  categories: LibraryCategoryDto[];
  /** Solo pistas reproducibles ahora mismo. Vacía mientras no haya canciones con derechos verificados. */
  tracks: LibraryTrackDto[];
  /** La pista que el evento ya tiene elegida, aunque ya no esté en la lista (desactivada, licencia vencida…). */
  selected?: { id: string; available: boolean; audioUrl?: string };
}
