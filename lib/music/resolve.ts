import type { MusicSettings } from "@/types/invitation";

/**
 * QUÉ SUENA EN UNA INVITACIÓN (D-46). La música publicada NO guarda la URL del audio: se RESUELVE al mostrar la invitación con el
 * estado ACTUAL de la pista y del plan del evento. Así, desactivar una pista (p. ej. por un problema de derechos) la silencia en
 * todas las invitaciones sin volver a publicarlas y sin tocar los snapshots históricos, y un evento que pierde su plan conserva su
 * elección (nada se borra) pero deja de reproducirla.
 *
 * Solo la biblioteca de Hilo Luna se reproduce. El enlace externo nunca se reproduce como música de fondo (docs/ARCHITECTURE.md §10.1)
 * y, como antes de D-46, la invitación pública no lo muestra.
 */
export interface ResolvedMusic {
  kind: "audio";
  src: string;
  title: string;
  author: string;
  /** Crédito obligatorio por la licencia (se muestra en la invitación). */
  attribution?: string;
  volume: number;
  loop: boolean;
  /** Empieza al pulsar «Abrir invitación» (el gesto del invitado). Si es `false` solo aparece el control. */
  startOnOpen: boolean;
  /** Vista previa del editor: nunca empieza sola. */
  preview: boolean;
}

/** Lo que el servidor sabe de la pista elegida, ya evaluado (`isTrackPlayable`). */
export interface PlayableTrack {
  id: string;
  title: string;
  author: string;
  audioUrl: string;
  attribution?: string;
}

/** `track`: solo si la pista existe y es reproducible. `entitled`: el plan del evento incluye `musicLibrary`. */
export function resolveLibraryMusic(settings: MusicSettings | undefined, track: PlayableTrack | undefined, entitled: boolean): ResolvedMusic | undefined {
  if (!settings || settings.sourceType !== "library" || settings.isEnabled === false) return undefined;
  if (!entitled || !track || track.id !== settings.libraryTrackId) return undefined;
  return {
    kind: "audio",
    src: track.audioUrl,
    title: track.title,
    author: track.author,
    ...(track.attribution ? { attribution: track.attribution } : {}),
    volume: settings.volume,
    loop: settings.loop,
    startOnOpen: settings.autoplayAfterInteraction,
    preview: false,
  };
}

/**
 * Vista previa del editor: el borrador trae `trackUrl` (lo pone el editor a partir de la biblioteca que le entregó el servidor, solo con
 * pistas reproducibles); nunca empieza sola.
 */
export function resolvePreviewMusic(settings: MusicSettings | undefined): ResolvedMusic | undefined {
  if (!settings || settings.sourceType !== "library" || settings.isEnabled === false || !settings.trackUrl) return undefined;
  return { kind: "audio", src: settings.trackUrl, title: settings.title, author: settings.artist ?? "", volume: settings.volume, loop: settings.loop, startOnOpen: settings.autoplayAfterInteraction, preview: true };
}
