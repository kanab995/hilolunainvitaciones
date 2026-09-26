import { InvitationShell } from "@/components/invitation/invitation-shell";
import { sectionRegistry } from "@/components/invitation/sections/registry";
import { resolveTemplateStyle, templateToCssVars } from "@/lib/invitation/styles";
import type { Invitation } from "@/types/invitation";
import type { InvitationTemplate } from "@/types/invitation-template";
import type { Personalization } from "@/types/public-rsvp";

type InvitationRendererProps = {
  /** DATA: el contenido de la invitación. */
  invitation: Invitation;
  /** TEMPLATE: solo presentación. Cualquier plantilla dibuja cualquier invitación. */
  template: InvitationTemplate;
  /** Hora del servidor (ms): referencia de la cuenta regresiva y del plazo de RSVP. */
  now: number;
  /** Invitado de un enlace personalizado (`?guest=`). Sin él, la invitación es general y no cambia nada. */
  personalization?: Personalization;
  /** `editor`: vista previa del editor (avisos en secciones vacías). Por defecto, la invitación pública. */
  mode?: "public" | "editor";
};

/**
 * RENDERER — el único componente que une DATA y TEMPLATE:
 *
 *   <InvitationRenderer invitation={data} template={template} now={serverNow} />
 *
 * Recorre `invitation.sections` (orden y visibilidad son datos), busca cada tipo en el registro
 * de secciones y le pasa los datos y la plantilla. Publica el tema como variables CSS `--inv-*`
 * sobre su contenedor (cascada: tema → personalización del usuario para ESA plantilla).
 * Nunca lee ni escribe estado de plantilla en la invitación, y no conoce ninguna plantilla por nombre.
 * Server Component: las islas cliente son `InvitationShell` (estado de apertura), la cuenta regresiva y el RSVP.
 */
export function InvitationRenderer({ invitation, template, now, personalization, mode = "public" }: InvitationRendererProps) {
  const style = resolveTemplateStyle(template);
  const cssVars = templateToCssVars(template, invitation.styleOverrides?.[template.slug]);
  const visible = invitation.sections.filter((section) => section.isVisible);

  return (
    <InvitationShell
      data-template={template.slug}
      data-reveal={style.reveal}
      style={cssVars}
      className="min-h-svh bg-inv-bg font-inv-body text-inv-ink-muted"
    >
      {visible.map((section, index) => {
        const Section = sectionRegistry[section.type];
        if (!Section) return null;
        return (
          <Section
            key={section.id}
            invitation={invitation}
            template={template}
            section={section}
            index={index}
            now={now}
            nextSectionId={visible[index + 1]?.id}
            personalization={personalization}
            editing={mode === "editor"}
          />
        );
      })}
    </InvitationShell>
  );
}
