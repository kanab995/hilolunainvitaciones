/**
 * Fallo al sincronizar la cuenta (Clerk ↔ perfil interno). El mensaje es interno: la interfaz muestra
 * un texto genérico (los límites de error de Next no exponen mensajes en producción).
 */
export type AuthSyncErrorCode = "no_email" | "email_conflict" | "database_unavailable" | "profile_unavailable";

export class AuthSyncError extends Error {
  readonly code: AuthSyncErrorCode;
  constructor(code: AuthSyncErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AuthSyncError";
    this.code = code;
  }
}
