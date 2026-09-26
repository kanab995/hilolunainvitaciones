"use client";

import { useEffect, useState } from "react";
import { InvitationRenderer } from "@/components/invitation/invitation-renderer";
import { draftFromMessage, PREVIEW_READY_MESSAGE } from "@/lib/editor/preview-channel";
import { defaultInvitationTemplate, getInvitationTemplate } from "@/lib/invitation/templates";
import type { Invitation } from "@/types/invitation";

/**
 * Superficie de la vista previa del editor: vive DENTRO del `<iframe>` (`/preview/[id]`, layout de
 * invitación con tokens --inv-*) y dibuja el MISMO `InvitationRenderer` que la página pública, con
 * el borrador que le envía el editor por `postMessage`. No es otra implementación: mismos datos +
 * misma plantilla = mismo resultado. Sin borrador recibido muestra la invitación inicial.
 */
export function PreviewSurface({ initial, now }: { initial: Invitation; now: number }) {
  const [invitation, setInvitation] = useState(initial);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const next = draftFromMessage(event, window.location.origin);
      if (next) setInvitation(next);
    };
    window.addEventListener("message", onMessage);
    // Avisa al editor de que ya puede enviar el borrador actual.
    window.parent?.postMessage({ type: PREVIEW_READY_MESSAGE }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const template = getInvitationTemplate(invitation.templateSlug) ?? defaultInvitationTemplate;
  return <InvitationRenderer invitation={invitation} template={template} now={now} mode="editor" />;
}
