/**
 * 404 de una invitación (no publicada, despublicada o enlace incorrecto). Lenguaje visual de
 * invitación (--inv-*, regla 7): no enlaza al producto; un invitado no tiene a dónde ir.
 */
export default function InvitationNotFound() {
  return (
    <div className="inv-column flex min-h-svh flex-col items-center justify-center gap-6 py-16 text-center">
      <p className="text-xs font-medium tracking-[0.2em] text-inv-accent uppercase">
        Invitación no disponible
      </p>
      <h1 className="font-inv-display text-4xl leading-tight font-medium text-inv-ink text-balance">
        Esta invitación <em className="italic">no está disponible</em>
      </h1>
      <p className="text-sm leading-relaxed text-inv-ink-muted">
        Puede que aún no se haya publicado o que el enlace no sea correcto. Si recibiste este
        enlace de un anfitrión, pídele que lo verifique.
      </p>
    </div>
  );
}
