import type { PublicationInfo } from "@/types/published";

/**
 * Resultados de las Server Actions de guardado y publicación (D-29). Sin detalles internos: solo códigos y
 * mensajes humanos. `revision` es la nueva revisión del borrador (control de concurrencia del editor).
 */
export type DraftSyncErrorCode = "unauthenticated" | "not_found" | "invalid" | "conflict" | "unavailable" | "plan_required" | "error";

export type SaveDraftResult = { ok: true; revision: number } | { ok: false; code: DraftSyncErrorCode; message: string; revision?: number };

export type PublishResult =
  | { ok: true; version: number; publication: PublicationInfo; revision: number; alreadyPublished: boolean }
  | { ok: false; code: DraftSyncErrorCode; message: string; revision?: number };
