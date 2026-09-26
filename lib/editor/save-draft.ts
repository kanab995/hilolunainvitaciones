import type { Invitation } from "@/types/invitation";

/**
 * Guardado del borrador SIN base de datos (modo demostración): simula una operación local (sin servidor, sin
 * `localStorage`). Con base de datos el editor usa `saveDraftAction` (D-29); esta función solo queda para el
 * entorno de demostración, donde el guardado real no existe y así se indica en la interfaz.
 */
export type SaveDraft = (invitation: Invitation) => Promise<void>;

export const SIMULATED_SAVE_MS = 450;

export const saveDraftLocally: SaveDraft = () => new Promise<void>((resolve) => setTimeout(resolve, SIMULATED_SAVE_MS));
