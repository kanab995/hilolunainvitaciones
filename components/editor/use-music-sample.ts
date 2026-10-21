"use client";

import { useEffect, useRef, useState } from "react";
import type { LibraryTrackDto } from "@/types/music";

export interface MusicSample {
  playingId: string | undefined;
  toggle: (track: LibraryTrackDto) => void;
}

/**
 * MUESTRA de una pista de la biblioteca en el editor (D-46). ÚNICO punto del editor que crea audio: siempre a partir de `audioUrl` de la
 * biblioteca de Hilo Luna (servida desde nuestro almacenamiento; la CSP `media-src` no admite otros orígenes), nunca un reproductor de
 * terceros. El `<audio>` se crea al PULSAR (gesto), con `preload="none"`, suena una sola muestra a la vez y se detiene al salir.
 */
export function useMusicSample(): MusicSample {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string>();

  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    [],
  );

  const toggle = (track: LibraryTrackDto) => {
    const current = audioRef.current;
    if (current && playingId === track.id) {
      current.pause();
      setPlayingId(undefined);
      return;
    }
    current?.pause();
    const audio = new Audio(track.audioUrl);
    audio.preload = "none";
    audio.addEventListener("ended", () => setPlayingId((id) => (id === track.id ? undefined : id)));
    audioRef.current = audio;
    setPlayingId(track.id);
    void audio.play().catch(() => setPlayingId(undefined));
  };

  return { playingId, toggle };
}
