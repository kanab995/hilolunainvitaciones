"use client";

import { Music2, Pause } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { invitationCopy } from "@/lib/invitation/copy";
import type { OpenController } from "@/lib/invitation/open-controller";
import { createMusicPlayer, type MusicPlayer as Player, type PlayerState } from "@/lib/music/player";
import type { ResolvedMusic } from "@/lib/music/resolve";
import { cn } from "@/lib/utils";

/**
 * REPRODUCTOR de la invitación (D-46, docs/ARCHITECTURE.md §10.1). Un único `<audio preload="none">`: el MP3 no se descarga al cargar la
 * página (no compite con la portada) y solo empieza con un gesto del invitado — «Abrir invitación» (si el anfitrión lo eligió) o este
 * botón. Sin `<iframe>`, sin SDK de terceros, sin `autoplay`. Se pausa al ocultar la pestaña. Las reglas viven en `lib/music/player.ts`.
 * El botón usa los colores de la plantilla (`--inv-*`) y mide 44 px (objetivo táctil mínimo en móvil).
 */
export function MusicPlayer({ music, subscribe }: { music: ResolvedMusic; subscribe: OpenController["subscribe"] }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [state, setState] = useState<PlayerState>("idle");
  const copy = invitationCopy.music;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const player = createMusicPlayer(audio, { startOnOpen: music.startOnOpen, preview: music.preview, volume: music.volume, loop: music.loop });
    playerRef.current = player;
    const offState = player.subscribe(setState);
    // El aviso de apertura llega SÍNCRONO dentro del clic: `play()` ocurre dentro del gesto (requisito de iOS).
    const offOpen = subscribe(() => player.onOpen());
    const onVisibility = () => player.onVisibilityChange(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      offState();
      offOpen();
      document.removeEventListener("visibilitychange", onVisibility);
      audio.pause();
      playerRef.current = null;
    };
  }, [music.startOnOpen, music.preview, music.volume, music.loop, subscribe]);

  const playing = state === "playing";
  const song = copy.song(music.title, music.author);

  return (
    <>
      <audio ref={audioRef} src={music.src} preload="none" loop={music.loop} data-music-audio />
      <button
        type="button"
        data-music-toggle
        data-state={state}
        aria-pressed={playing}
        aria-label={playing ? copy.pause(song) : copy.play(song)}
        title={song}
        onClick={() => playerRef.current?.toggle()}
        className={cn(
          "fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex size-11 items-center justify-center rounded-full border border-inv-line bg-inv-surface text-inv-ink shadow-[0_10px_30px_-12px_rgb(0_0_0/0.35)] outline-none transition-transform duration-150 hover:scale-105 focus-visible:ring-2 focus-visible:ring-inv-accent motion-reduce:transition-none motion-reduce:hover:scale-100",
          playing && "text-inv-accent",
        )}
      >
        {playing ? <Pause aria-hidden="true" className="size-5" /> : <Music2 aria-hidden="true" className="size-5" />}
      </button>
      {state === "blocked" ? (
        <p role="status" className="sr-only">
          {copy.blocked}
        </p>
      ) : null}
      {music.attribution ? (
        <p data-music-credit className="bg-inv-bg px-6 pt-2 pb-24 text-center font-inv-body text-[0.6875rem] leading-relaxed text-inv-ink-muted">
          {copy.credit(music.attribution)}
        </p>
      ) : null}
    </>
  );
}
