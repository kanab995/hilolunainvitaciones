import { CalendarPlus } from "lucide-react";
import { InvButton, invButtonClass } from "@/components/invitation/primitives/inv-button";
import { CountdownDisplay } from "@/components/invitation/sections/countdown-display";
import { SectionHeading } from "@/components/invitation/primitives/section-heading";
import { SectionShell } from "@/components/invitation/primitives/section-shell";
import type { SectionProps } from "@/components/invitation/sections/types";
import { invitationCopy } from "@/lib/invitation/copy";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * CUENTA REGRESIVA hacia `invitation.event.startsAt`. La misma lógica para toda plantilla; no guarda
 * ningún estado (solo avanza el reloj a partir de la hora del servidor).
 */
export function CountdownSection({ invitation, template, section, index, now, editing }: SectionProps) {
  // El calendario existe solo para invitaciones PUBLICADAS; las demos `demo-<plantilla>` no lo tienen.
  const showCalendar = !invitation.slug.startsWith("demo-");
  return (
    <SectionShell section={section} template={template} index={index} width="wide" contentClassName="py-14 md:py-20">
      {/* Composición ancha (no la columna de lectura): cuatro columnas con ancho real en escritorio. */}
      <div className="inv-reveal mx-auto flex w-full flex-col items-center gap-7 md:gap-10">
        <div className="w-full max-w-[30rem]">
          <SectionHeading section={section} template={template} fallbackTitle={invitationCopy.sections.countdown} />
        </div>
        <div className="w-full max-w-[30rem] md:max-w-[45rem]">
          <CountdownDisplay targetIso={invitation.event.startsAt} serverNowMs={now} />
        </div>
        {showCalendar ? (
          // Descarga el `.ics` de la versión PUBLICADA (sin sesión y sin datos del invitado). En la vista previa del editor no es un enlace.
          editing ? (
            <span aria-disabled="true" className={cn(invButtonClass("outline", "lg"), "opacity-60")}>
              <CalendarPlus aria-hidden="true" className="size-4" strokeWidth={1.5} />
              {invitationCopy.addToCalendar}
            </span>
          ) : (
            <InvButton href={routes.invitationCalendar(invitation.slug)} download variant="outline" size="lg" data-calendar-cta>
              <CalendarPlus aria-hidden="true" className="size-4" strokeWidth={1.5} />
              {invitationCopy.addToCalendar}
            </InvButton>
          )
        ) : null}
      </div>
    </SectionShell>
  );
}
