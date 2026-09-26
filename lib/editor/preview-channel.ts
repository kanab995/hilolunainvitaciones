import type { Invitation } from "@/types/invitation";

/**
 * Canal editor → vista previa (docs/ARCHITECTURE.md D-07). La vista previa es un `<iframe>` de la
 * ruta `/preview/[id]` (mismo origen) que dibuja el MISMO `InvitationRenderer` que la página pública;
 * el editor le envía el borrador con `postMessage` en cada cambio. Un iframe da un viewport real
 * (390 px en "Móvil"): las media queries de la invitación se comportan como en un teléfono.
 */
export const PREVIEW_DRAFT_MESSAGE = "hiloluna:preview:draft" as const;
export const PREVIEW_READY_MESSAGE = "hiloluna:preview:ready" as const;

export interface PreviewDraftMessage {
  type: typeof PREVIEW_DRAFT_MESSAGE;
  invitation: Invitation;
}

export interface PreviewReadyMessage {
  type: typeof PREVIEW_READY_MESSAGE;
}

export function isPreviewDraftMessage(data: unknown): data is PreviewDraftMessage {
  if (typeof data !== "object" || data === null) return false;
  const message = data as Partial<PreviewDraftMessage>;
  const invitation = message.invitation as Partial<Invitation> | undefined;
  return (
    message.type === PREVIEW_DRAFT_MESSAGE &&
    typeof invitation === "object" &&
    invitation !== null &&
    Array.isArray(invitation.sections) &&
    Array.isArray(invitation.names) &&
    typeof invitation.templateSlug === "string"
  );
}

export function isPreviewReadyMessage(data: unknown): data is PreviewReadyMessage {
  return typeof data === "object" && data !== null && (data as Partial<PreviewReadyMessage>).type === PREVIEW_READY_MESSAGE;
}

/**
 * Nuevo borrador a partir de un mensaje, o `null` si hay que ignorarlo: solo se aceptan mensajes del
 * mismo origen con la forma esperada.
 */
export function draftFromMessage(event: { origin: string; data: unknown }, ownOrigin: string): Invitation | null {
  if (event.origin !== ownOrigin) return null;
  return isPreviewDraftMessage(event.data) ? event.data.invitation : null;
}
