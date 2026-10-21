/**
 * CONTROLADOR DEL REPRODUCTOR de la invitación (D-46, docs/ARCHITECTURE.md §10.1). Lógica pura sobre un `<audio>` abstracto: se prueba
 * sin navegador. Reglas:
 *  - La carga de la página NUNCA reproduce. El audio no se descarga hasta que hace falta (`preload="none"` en el elemento).
 *  - `onOpen()` se llama SÍNCRONAMENTE dentro del clic en «Abrir invitación» (Safari/iOS solo permite `play()` dentro de un gesto):
 *    si `startOnOpen`, empieza ahí. En la vista previa del editor nunca empieza sola.
 *  - Si el navegador rechaza `play()` (política de reproducción automática, modo de bajo consumo…), queda en `blocked`: el botón
 *    sigue disponible y un toque del invitado lo reintenta (ese toque sí es un gesto).
 *  - Al ocultarse la pestaña se pausa; al volver solo se reanuda si la pausa la provocó la pestaña oculta (no si el invitado la pausó).
 *  - En iOS el volumen de un `<audio>` no se puede cambiar desde la página (lo controla el teléfono): asignarlo es inofensivo.
 */
export interface AudioLike {
  play(): Promise<void> | void;
  pause(): void;
  volume: number;
  loop: boolean;
}

export type PlayerState = "idle" | "playing" | "paused" | "blocked";

export interface MusicPlayerOptions {
  startOnOpen: boolean;
  preview: boolean;
  volume: number;
  loop: boolean;
}

export interface MusicPlayer {
  state(): PlayerState;
  /** Gesto «Abrir invitación». */
  onOpen(): void;
  /** Botón de reproducir/pausar (gesto del invitado). */
  toggle(): void;
  onVisibilityChange(hidden: boolean): void;
  /** Avisa de cambios de estado (para pintar el botón). */
  subscribe(listener: (state: PlayerState) => void): () => void;
}

export function createMusicPlayer(audio: AudioLike, options: MusicPlayerOptions): MusicPlayer {
  let state: PlayerState = "idle";
  let pausedByVisibility = false;
  const listeners = new Set<(state: PlayerState) => void>();
  const set = (next: PlayerState) => {
    if (next === state) return;
    state = next;
    for (const listener of [...listeners]) listener(state);
  };

  audio.loop = options.loop;
  try {
    audio.volume = Math.max(0, Math.min(1, options.volume));
  } catch {
    // Algunos navegadores lo tratan como de solo lectura: no es un error.
  }

  const play = () => {
    // `play()` se invoca de forma síncrona dentro del gesto; su promesa solo informa del resultado.
    set("playing");
    try {
      const result = audio.play();
      if (result && typeof result.then === "function") result.then(undefined, () => set("blocked"));
    } catch {
      set("blocked");
    }
  };
  const pause = () => {
    audio.pause();
    set("paused");
  };

  return {
    state: () => state,
    onOpen() {
      if (options.preview || !options.startOnOpen || state !== "idle") return;
      play();
    },
    toggle() {
      pausedByVisibility = false;
      if (state === "playing") pause();
      else play();
    },
    onVisibilityChange(hidden) {
      if (hidden && state === "playing") {
        pausedByVisibility = true;
        pause();
      } else if (!hidden && pausedByVisibility) {
        pausedByVisibility = false;
        play();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
