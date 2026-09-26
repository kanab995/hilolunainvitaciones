"use client";

import { useState } from "react";
import { useEditor } from "@/components/editor/editor-context";
import { TextField } from "@/components/editor/fields/text-field";
import { Badge } from "@/components/ui/badge";
import { LIMITS } from "@/lib/editor/validation";
import { siteConfig } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import type { MusicSettings } from "@/types/invitation";

type Choice = "none" | "library" | "upload" | "external";

const choices: readonly { value: Choice; label: string; description: string; soon?: boolean }[] = [
  { value: "none", label: "Sin música", description: "La invitación no tendrá canción." },
  { value: "library", label: `Biblioteca ${siteConfig.name}`, description: `Canciones con licencia incluidas en ${siteConfig.name}.`, soon: true },
  { value: "upload", label: "Subir archivo", description: "Tu propio audio, confirmando que tienes los derechos.", soon: true },
  { value: "external", label: "Enlace externo", description: "Un enlace a la canción en Spotify, YouTube u otro sitio." },
];

const emptyExternal: MusicSettings = {
  sourceType: "external",
  externalUrl: "",
  title: "",
  autoplayAfterInteraction: false,
  volume: 0.6,
  loop: true,
};

/**
 * Música: solo configuración (política aprobada, docs/ARCHITECTURE.md §10.1). No hay reproductor, ni
 * SDK de Spotify, ni YouTube embebido, ni subida de audio real. El enlace externo es SOLO un enlace:
 * no suena como música de fondo. Biblioteca y subida aparecen como «Próximamente» y no se pueden elegir.
 */
export function MusicEditor() {
  const { draft, api, errors } = useEditor();
  const music = draft.music;
  const choice: Choice = music?.sourceType === "external" ? "external" : "none";
  // Recuerda la configuración externa al pasar por «Sin música» (no se pierde al cambiar de opinión).
  const [remembered, setRemembered] = useState<MusicSettings>();

  const select = (value: Choice) => {
    if (value === "none") {
      if (music?.sourceType === "external") setRemembered(music);
      api.updateInvitation({ music: undefined });
    } else if (value === "external") {
      api.updateInvitation({ music: remembered ?? emptyExternal });
    }
  };

  const patch = (change: Partial<MusicSettings>) => api.updateInvitation((d) => (d.music ? { music: { ...d.music, ...change } } : {}));

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-lu-sm font-medium text-lu-text">Origen de la música</legend>
        {choices.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex items-start gap-3 rounded-lu-card border bg-lu-surface p-4 transition-colors duration-150 ease-lu-standard has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-lu-brown-600",
              choice === option.value ? "border-lu-brown-600 bg-lu-nav-active" : "border-lu-border-subtle",
              option.soon ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-lu-border-outline",
            )}
          >
            <input
              type="radio"
              name="music-source"
              value={option.value}
              checked={choice === option.value}
              disabled={option.soon}
              onChange={() => select(option.value)}
              className="mt-1 size-4 accent-[var(--lu-brown-600)]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-2 text-lu-base font-medium text-lu-text">
                {option.label}
                {option.soon ? <Badge tone="outline">Próximamente</Badge> : null}
              </span>
              <span className="text-lu-sm text-lu-text-muted">{option.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {music?.sourceType === "external" ? (
        <div className="flex flex-col gap-4">
          <TextField
            id="music-url"
            label="Enlace"
            type="url"
            inputMode="url"
            placeholder="https://"
            hint="Debe empezar con https://."
            value={music.externalUrl ?? ""}
            error={errors["music.externalUrl"]}
            onChange={(externalUrl) => patch({ externalUrl })}
          />
          <div className="grid gap-4 @md:grid-cols-2">
            <TextField id="music-title" label="Título de la canción" max={LIMITS.musicTitle} value={music.title} error={errors["music.title"]} onChange={(title) => patch({ title })} />
            <TextField id="music-artist" label="Artista" max={LIMITS.musicArtist} optional value={music.artist ?? ""} error={errors["music.artist"]} onChange={(artist) => patch({ artist })} />
          </div>
          <p className="rounded-lu-card bg-lu-surface-tint/60 p-4 text-lu-sm text-lu-text-secondary">
            Un enlace externo es solo un enlace: no se reproduce como música de fondo dentro de la invitación.
          </p>
        </div>
      ) : null}

      <p className="text-lu-sm text-lu-text-muted">
        Todavía no hay reproductor. Cuando exista, la música solo empezará después de que tus invitados pulsen «Abrir invitación».
      </p>
    </div>
  );
}
