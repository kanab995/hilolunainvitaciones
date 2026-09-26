/**
 * Invitación cuyo acceso terminó (D-34): el evento fue de pago y ya pasó su ventana (`paidAccessEndsAt`, 30 días después de la fecha).
 * Lenguaje visual de invitación (`--inv-*`, regla 7); sin marca de producto ni enlaces (un invitado no tiene a dónde ir). NO muestra nada
 * del evento —ni nombres, ni fecha, ni lugar—: el contenido no se lee. Nada se borra: si el anfitrión mejora el evento o mueve la fecha, la
 * invitación vuelve a estar disponible.
 */
export const EXPIRED_INVITATION_TITLE = "Esta invitación ya no está disponible.";

export function ExpiredInvitation() {
  return (
    <div data-invitation-state="expired" className="inv-column flex min-h-svh flex-col items-center justify-center gap-6 py-16 text-center">
      <p className="text-xs font-medium tracking-[0.2em] text-inv-accent uppercase">Invitación</p>
      <h1 className="font-inv-display text-4xl leading-tight font-medium text-inv-ink text-balance">
        Esta invitación <em className="italic">ya no está disponible.</em>
      </h1>
      <p className="max-w-xs text-sm leading-relaxed text-inv-ink-muted">El período en el que se podía consultar terminó. Si necesitas algún dato del evento, contacta directamente a tus anfitriones.</p>
    </div>
  );
}
