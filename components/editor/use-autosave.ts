"use client";

import { useEffect, useRef, useState } from "react";
import { createAutosaver, type Autosaver, type AutosaveState } from "@/lib/editor/autosave";
import type { SaveDraft } from "@/lib/editor/save-draft";
import type { ValidationErrors } from "@/lib/editor/validation";
import type { Invitation } from "@/types/invitation";

/**
 * Conecta el borrador con el autoguardado (real con base de datos, D-29): cada cambio marca "dirty", tras el debounce pasa a
 * "Guardando…" y termina en "Guardado". Mientras haya errores de validación no guarda y lo indica.
 */
export function useAutosave(draft: Invitation, options: { initial: Invitation; save: SaveDraft; errors: ValidationErrors; delayMs?: number }) {
  const { initial, save, errors, delayMs } = options;
  const [state, setState] = useState<AutosaveState>({ status: "idle" });
  const errorsRef = useRef(errors);
  const saverRef = useRef<Autosaver<Invitation> | null>(null);

  useEffect(() => {
    errorsRef.current = errors;
  }, [errors]);

  useEffect(() => {
    const saver = createAutosaver<Invitation>({
      initial,
      save,
      delayMs,
      validate: () => (Object.keys(errorsRef.current).length > 0 ? "Corrige los campos marcados para guardar." : undefined),
      onChange: setState,
    });
    saverRef.current = saver;
    return () => {
      saver.dispose();
      saverRef.current = null;
    };
  }, [initial, save, delayMs]);

  useEffect(() => {
    saverRef.current?.notify(draft);
  }, [draft, errors]);

  return {
    state,
    retry: () => void saverRef.current?.flush(),
    /** Guarda lo pendiente y resuelve con el estado final (`saved`/`idle` = todo guardado; `error` = no se pudo). */
    flush: async (): Promise<AutosaveState> => {
      await saverRef.current?.flush();
      return saverRef.current?.getState() ?? { status: "idle" };
    },
  };
}
