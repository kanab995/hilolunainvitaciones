/**
 * AUTOGUARDADO. Máquina de estados sin React:
 *
 *   idle/saved ─cambio→ dirty ─(debounce)→ saving ─→ saved
 *                                             └──→ error ─(otro cambio o reintentar)→ dirty/saving
 *
 * No guarda en cada tecla: espera `delayMs` (600–1000 ms) desde el último cambio y cada tecla lo reinicia. La función que
 * guarda es inyectable (`save`): en producción la Server Action `saveDraftAction` (D-29); `saveDraftLocally` solo se
 * usa sin base de datos. `flush()` espera a que TODO lo pendiente termine (guardado en curso incluido): publicar
 * primero guarda y solo después publica. No usa `localStorage` como fuente de verdad.
 */

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export interface AutosaveState {
  status: SaveStatus;
  /** Detalle del error, si lo hay. */
  message?: string;
  /** Marca de tiempo (ms) del último guardado correcto. */
  savedAt?: number;
}

export interface AutosaveOptions<T> {
  /** Guarda el borrador. Debe rechazar la promesa si falla. */
  save: (value: T) => Promise<void>;
  /** Devuelve un mensaje si el valor no se puede guardar todavía (validación); no se llama a `save`. */
  validate?: (value: T) => string | undefined;
  /** Espera tras el último cambio (ms). Por defecto 800. */
  delayMs?: number;
  /** Valor ya guardado al empezar: cambios que lo igualen no ensucian el estado. */
  initial: T;
  onChange: (state: AutosaveState) => void;
  now?: () => number;
}

export interface Autosaver<T> {
  /** Avisa de un nuevo valor del borrador. */
  notify(value: T): void;
  /** Guarda ya (sin esperar el debounce) y RESUELVE cuando no queda nada pendiente (o hubo un error: ver `getState`). */
  flush(): Promise<void>;
  dispose(): void;
  getState(): AutosaveState;
}

export const AUTOSAVE_DELAY_MS = 800;

export function createAutosaver<T>(options: AutosaveOptions<T>): Autosaver<T> {
  const { save, validate, initial, onChange, delayMs = AUTOSAVE_DELAY_MS, now = Date.now } = options;
  // «Sin cambios» hasta el primer guardado: distinto de «Guardado» (algo se guardó de verdad).
  let state: AutosaveState = { status: "idle" };
  let saved: T = initial;
  let latest: T = initial;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let saving = false;
  let disposed = false;
  let inflight: Promise<void> | undefined;

  const setState = (next: AutosaveState) => {
    if (disposed) return;
    state = next;
    onChange(state);
  };

  const clearTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  async function run(): Promise<void> {
    clearTimer();
    if (saving || disposed) return;
    if (latest === saved) {
      if (state.status !== "saved" && state.status !== "idle") setState({ status: "saved", savedAt: state.savedAt ?? now() });
      return;
    }
    const problem = validate?.(latest);
    if (problem) {
      setState({ status: "error", message: problem });
      return;
    }

    const value = latest;
    saving = true;
    setState({ status: "saving" });
    try {
      await save(value);
      saved = value;
      saving = false;
      // Si llegaron cambios mientras se guardaba, se programa otro guardado.
      if (latest !== saved) {
        setState({ status: "dirty" });
        timer = setTimeout(() => void runTracked(), delayMs);
      } else {
        setState({ status: "saved", savedAt: now() });
      }
    } catch (error) {
      saving = false;
      setState({ status: "error", message: error instanceof Error ? error.message : "No se pudo guardar." });
    }
  }

  /** Ejecuta `run` registrándolo como guardado en curso (para que `flush` pueda esperarlo). */
  function runTracked(): Promise<void> {
    if (inflight) return inflight;
    inflight = run().finally(() => {
      inflight = undefined;
    });
    return inflight;
  }

  /** Espera al guardado en curso y guarda lo pendiente hasta que no quede nada (o falle). */
  async function settle(): Promise<void> {
    for (let guard = 0; guard < 20; guard += 1) {
      clearTimer();
      if (inflight) {
        await inflight;
        if (state.status === "error") return;
        continue;
      }
      if (latest === saved || disposed) return;
      await runTracked();
      if (state.status === "error") return;
    }
  }

  return {
    notify(value) {
      latest = value;
      if (value === saved) {
        clearTimer();
        if (!saving && state.status !== "idle") setState({ status: "saved", savedAt: state.savedAt ?? now() });
        return;
      }
      if (!saving) setState({ status: "dirty" });
      clearTimer();
      timer = setTimeout(() => void runTracked(), delayMs);
    },
    flush: settle,
    dispose() {
      disposed = true;
      clearTimer();
    },
    getState: () => state,
  };
}
