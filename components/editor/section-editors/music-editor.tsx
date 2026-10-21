"use client";

import { useState } from "react";
import { useEditor } from "@/components/editor/editor-context";
import { TextField } from "@/components/editor/fields/text-field";
import { MusicLibraryPicker } from "@/components/editor/section-editors/music-library-picker";
import { Badge } from "@/components/ui/badge";
import { musicEditorCopy as copy } from "@/lib/editor/music-copy";
import { LIMITS } from "@/lib/editor/validation";
import { cn } from "@/lib/utils";
import type { MusicSettings } from "@/types/invitation";

type Choice = "none" | "library" | "upload" | "external";

const emptyExternal: MusicSettings = { sourceType: "external", externalUrl: "", title: "", autoplayAfterInteraction: false, volume: 0.6, loop: true };

/**
 * Música (D-46). Tres orígenes: «Sin música», la BIBLIOTECA de Hilo Luna (Esencial y Premium; solo pistas con derechos verificados,
 * `MusicLibraryPicker`) y el ENLACE externo (solo un enlace, en todos los planes, como antes). La subida de audio propio sigue como
 * «Próximamente». La vista previa del editor nunca reproduce sola.
 */
export function MusicEditor() {
  const { draft, api, errors, musicLibrary } = useEditor();
  const music = draft.music;
  const current: Choice = music?.sourceType === "external" ? "external" : music?.sourceType === "library" ? "library" : "none";
  const [choice, setChoice] = useState<Choice>(current);
  // Recuerda la configuración anterior al cambiar de opción (no se pierde al cambiar de opinión dentro de la sesión).
  const [remembered, setRemembered] = useState<{ external?: MusicSettings; library?: MusicSettings }>({});
  const libraryLocked = !musicLibrary.allowed && current !== "library";

  const select = (value: Choice) => {
    if (value === "upload" || (value === "library" && libraryLocked)) return;
    const next = { ...remembered, ...(music?.sourceType === "external" ? { external: music } : {}), ...(music?.sourceType === "library" ? { library: music } : {}) };
    setRemembered(next);
    setChoice(value);
    if (value === "none") api.updateInvitation({ music: undefined });
    else if (value === "external") api.updateInvitation({ music: next.external ?? emptyExternal });
    else api.updateInvitation({ music: next.library });
  };

  const patch = (change: Partial<MusicSettings>) => api.updateInvitation((d) => (d.music ? { music: { ...d.music, ...change } } : {}));

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-lu-sm font-medium text-lu-text">{copy.legend}</legend>
        {(["none", "library", "upload", "external"] as const).map((value) => {
          const disabled = value === "upload" || (value === "library" && libraryLocked);
          return (
            <label
              key={value}
              className={cn(
                "flex items-start gap-3 rounded-lu-card border bg-lu-surface p-4 transition-colors duration-150 ease-lu-standard has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-lu-brown-600",
                choice === value ? "border-lu-brown-600 bg-lu-nav-active" : "border-lu-border-subtle",
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-lu-border-outline",
              )}
            >
              <input type="radio" name="music-source" value={value} checked={choice === value} disabled={disabled} onChange={() => select(value)} className="mt-1 size-4 accent-[var(--lu-brown-600)]" />
              <span className="flex flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2 text-lu-base font-medium text-lu-text">
                  {copy.choices[value].label}
                  {value === "upload" ? <Badge tone="outline">{copy.soon}</Badge> : null}
                  {value === "library" && !musicLibrary.allowed ? <Badge tone="outline">{copy.plan}</Badge> : null}
                </span>
                <span className="text-lu-sm text-lu-text-muted">{copy.choices[value].description}</span>
              </span>
            </label>
          );
        })}
        {libraryLocked ? <p className="text-lu-sm text-lu-text-muted">{copy.planNotice}</p> : null}
      </fieldset>

      {choice === "library" ? <MusicLibraryPicker onPatch={patch} /> : null}

      {music?.sourceType === "external" && choice === "external" ? (
        <div className="flex flex-col gap-4">
          <TextField id="music-url" label="Enlace" type="url" inputMode="url" placeholder="https://" hint="Debe empezar con https://." value={music.externalUrl ?? ""} error={errors["music.externalUrl"]} onChange={(externalUrl) => patch({ externalUrl })} />
          <div className="grid gap-4 @md:grid-cols-2">
            <TextField id="music-title" label="Título de la canción" max={LIMITS.musicTitle} value={music.title} error={errors["music.title"]} onChange={(title) => patch({ title })} />
            <TextField id="music-artist" label="Artista" max={LIMITS.musicArtist} optional value={music.artist ?? ""} error={errors["music.artist"]} onChange={(artist) => patch({ artist })} />
          </div>
          <p className="rounded-lu-card bg-lu-surface-tint/60 p-4 text-lu-sm text-lu-text-secondary">{copy.externalNote}</p>
        </div>
      ) : null}

      <p className="text-lu-sm text-lu-text-muted">{copy.rules}</p>
    </div>
  );
}
