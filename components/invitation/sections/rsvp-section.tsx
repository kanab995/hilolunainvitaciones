import { GeneralRsvpForm } from "@/components/invitation/sections/general-rsvp-form";
import { PersonalizedRsvp } from "@/components/invitation/sections/personalized-rsvp";
import { RsvpPanel } from "@/components/invitation/sections/rsvp-panel";
import { SectionHeading } from "@/components/invitation/primitives/section-heading";
import { SectionShell } from "@/components/invitation/primitives/section-shell";
import type { SectionProps } from "@/components/invitation/sections/types";
import { invitationCopy } from "@/lib/invitation/copy";
import { isDemoInvitation } from "@/lib/invitation/is-demo";

/**
 * CONFIRMA TU ASISTENCIA. Toda la lógica (plazo, "tal vez", acompañantes, validación) vive en
 * `lib/invitation/rsvp.ts` y en tres componentes, alimentados por `invitation.rsvp` (la plantilla solo
 * aporta el estilo del botón; no existe una versión de RSVP por plantilla):
 *  - `PersonalizedRsvp`: enlace `?guest=` válido (invitado que ya existía) — se guarda de verdad.
 *  - `GeneralRsvpForm` (D-40): invitación REAL sin `?guest=` — autorregistra un invitado nuevo y SÍ
 *    se guarda de verdad (cuota propia, separada de la de invitados del anfitrión).
 *  - `RsvpPanel`: SOLO demos públicas (`isDemoInvitation`) — nunca guarda nada, con aviso "modo
 *    demostración" siempre visible.
 */
export function RSVPSection({ invitation, template, section, index, now, personalization }: SectionProps) {
  const buttonVariant = template.componentStyles.button.variant;
  return (
    <SectionShell
      section={section}
      template={template}
      index={index}
      decor={["sectionTopLeft", "sectionBottomRight"]}
      contentClassName="py-16 md:py-24"
    >
      <div className="inv-reveal mx-auto flex max-w-[28rem] flex-col items-center gap-5 text-center">
        <SectionHeading section={section} template={template} fallbackTitle={invitationCopy.sections.rsvp} />
        <p className="max-w-[21rem] font-inv-body text-[0.8125rem] leading-relaxed text-inv-ink-muted md:text-[0.9375rem]">{invitation.rsvp.message}</p>
        {personalization?.kind === "guest" ? (
          <PersonalizedRsvp personalization={personalization} settings={invitation.rsvp} serverNowMs={now} buttonVariant={buttonVariant} />
        ) : personalization?.kind === "invalid" ? (
          <div role="status" data-guest-invalid className="flex max-w-[21rem] flex-col gap-1 text-center font-inv-body text-sm text-inv-ink-muted">
            <p className="text-inv-ink">{invitationCopy.guestRsvp.invalidToken}</p>
            <p>{invitationCopy.guestRsvp.invalidTokenHelp}</p>
          </div>
        ) : isDemoInvitation(invitation) ? (
          <RsvpPanel settings={invitation.rsvp} serverNowMs={now} buttonVariant={buttonVariant} />
        ) : (
          <GeneralRsvpForm invitationSlug={invitation.slug} settings={invitation.rsvp} serverNowMs={now} buttonVariant={buttonVariant} />
        )}
      </div>
    </SectionShell>
  );
}
