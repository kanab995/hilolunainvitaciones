"use client";

import { Pause, Play } from "lucide-react";
import { useState } from "react";
import { useEditor } from "@/components/editor/editor-context";
import { ToggleRow } from "@/components/editor/fields/toggle-row";
import { useMusicSample, type MusicSample } from "@/components/editor/use-music-sample";
import { Chip } from "@/components/ui/chip";
import { musicEditorCopy as copy } from "@/lib/editor/music-copy";
import { formatDuration } from "@/lib/music/limits";
import { cn } from "@/lib/utils";
import type { MusicSettings } from "@/types/invitation";
import type { LibraryTrackDto } from "@/types/music";

/**
 * Biblioteca de Hilo Luna dentro del editor (D-46): canción elegida con sus interruptores, categorías y lista con muestra. Elegir una pista
 * guarda solo su id (título, autor y audio los pone el servidor); la URL del audio va en el borrador solo para la vista previa.
 */
export function MusicLibraryPicker({ onPatch }: { onPatch: (change: Partial<MusicSettings>) => void }) {
  const { draft, api, errors, musicLibrary } = useEditor();
  const music = draft.music?.sourceType === "library" ? draft.music : undefined;
  const [category, setCategory] = useState<string>("all");
  const sample = useMusicSample();
  const { tracks, categories } = musicLibrary;
  const selectedTrack = music ? tracks.find((track) => track.id === music.libraryTrackId) : undefined;
  const unavailable = Boolean(music?.libraryTrackId && !selectedTrack && musicLibrary.selected?.id === music.libraryTrackId && !musicLibrary.selected.available);
  const visible = category === "all" ? tracks : tracks.filter((track) => track.categorySlug === category);
  const withTracks = categories.filter((item) => tracks.some((track) => track.categorySlug === item.slug));

  const use = (track: LibraryTrackDto) => {
    if (!musicLibrary.allowed) return;
    api.updateInvitation((d) => ({
      music: {
        sourceType: "library",
        libraryTrackId: track.id,
        title: track.title,
        artist: track.author,
        // Solo para la vista previa: el guardado no envía la URL y el servidor la resuelve al mostrar la invitación.
        trackUrl: track.audioUrl,
        autoplayAfterInteraction: d.music?.sourceType === "library" ? d.music.autoplayAfterInteraction : true,
        volume: d.music?.volume ?? 0.6,
        loop: d.music?.loop ?? true,
        ...(d.music?.sourceType === "library" && d.music.isEnabled === false ? { isEnabled: false } : {}),
      },
    }));
  };

  return (
    <div className="flex flex-col gap-5">
      {music ? (
        <div className="flex flex-col gap-4 rounded-lu-card border border-lu-border-subtle bg-lu-surface p-4" data-music-selected={music.libraryTrackId}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-col">
              <span className="text-lu-xs font-medium tracking-[0.08em] text-lu-text-muted uppercase">{copy.selected}</span>
              <span className="truncate font-lu-display text-lu-title-sm text-lu-text">{music.title}</span>
              {music.artist ? <span className="truncate text-lu-sm text-lu-text-muted">{music.artist}</span> : null}
            </div>
            {selectedTrack ? <SampleButton track={selectedTrack} sample={sample} /> : null}
          </div>
          {unavailable ? (
            <p role="alert" className="text-lu-sm text-lu-error">
              {copy.unavailable}
            </p>
          ) : null}
          {selectedTrack?.attribution ? <p className="text-lu-sm text-lu-text-muted">{copy.credit(selectedTrack.attribution)}</p> : null}
          <ToggleRow id="music-enabled" label={copy.enabled.label} hint={copy.enabled.hint} checked={music.isEnabled !== false} onChange={(on) => onPatch({ isEnabled: on ? undefined : false })} />
          <ToggleRow id="music-start" label={copy.startOnOpen.label} hint={copy.startOnOpen.hint} checked={music.autoplayAfterInteraction} onChange={(autoplayAfterInteraction) => onPatch({ autoplayAfterInteraction })} disabled={music.isEnabled === false} />
        </div>
      ) : null}
      {errors["music.track"] ? (
        <p role="alert" className="text-lu-sm text-lu-error">
          {errors["music.track"]}
        </p>
      ) : null}

      {tracks.length === 0 ? (
        <p className="rounded-lu-card bg-lu-surface-tint/60 p-4 text-lu-sm text-lu-text-secondary" data-music-empty>
          {copy.empty}
        </p>
      ) : (
        <>
          <div role="group" aria-label={copy.categories} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <Chip active={category === "all"} onClick={() => setCategory("all")} className="h-9 px-4 text-lu-sm">
              {copy.all}
            </Chip>
            {withTracks.map((item) => (
              <Chip key={item.slug} active={category === item.slug} onClick={() => setCategory(item.slug)} className="h-9 px-4 text-lu-sm">
                {item.name}
              </Chip>
            ))}
          </div>
          {visible.length === 0 ? (
            <p className="text-lu-sm text-lu-text-muted">{copy.emptyCategory}</p>
          ) : (
            <ul aria-label={copy.tracks} className="flex flex-col divide-y divide-lu-border-subtle rounded-lu-card border border-lu-border-subtle bg-lu-surface">
              {visible.map((track) => {
                const chosen = music?.libraryTrackId === track.id;
                return (
                  <li key={track.id} data-track={track.id} className="flex items-center gap-3 px-3 py-2.5">
                    <SampleButton track={track} sample={sample} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-lu-base text-lu-text">{track.title}</span>
                      <span className="truncate text-lu-sm text-lu-text-muted">
                        {track.author}
                        {track.durationSec ? ` · ${formatDuration(track.durationSec)}` : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-pressed={chosen}
                      disabled={!musicLibrary.allowed}
                      onClick={() => use(track)}
                      className={cn(
                        "h-11 shrink-0 rounded-lu-pill border px-4 text-lu-sm outline-none focus-visible:ring-2 focus-visible:ring-lu-brown-600 disabled:cursor-not-allowed disabled:opacity-60",
                        chosen ? "border-lu-ink bg-lu-ink text-lu-on-ink" : "border-lu-border-outline text-lu-text hover:bg-lu-selected",
                      )}
                    >
                      {chosen ? copy.inUse : copy.use}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function SampleButton({ track, sample }: { track: LibraryTrackDto; sample: MusicSample }) {
  const playing = sample.playingId === track.id;
  return (
    <button
      type="button"
      aria-pressed={playing}
      aria-label={playing ? copy.stopSample(track.title) : copy.sample(track.title)}
      onClick={() => sample.toggle(track)}
      className="flex size-11 shrink-0 items-center justify-center rounded-full border border-lu-border-outline text-lu-text outline-none hover:bg-lu-selected focus-visible:ring-2 focus-visible:ring-lu-brown-600"
    >
      {playing ? <Pause aria-hidden="true" className="size-4" /> : <Play aria-hidden="true" className="size-4" />}
    </button>
  );
}
