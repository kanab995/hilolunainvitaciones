import { Divider } from "@/components/invitation/primitives/divider";
import { SectionShell } from "@/components/invitation/primitives/section-shell";
import type { SectionProps } from "@/components/invitation/sections/types";
import { displayNames, formatCompactDate } from "@/lib/invitation/format";

/**
 * CIERRE editorial: nombres, fecha compacta y mensaje final (`invitation.closing`) con decoración
 * floral sutil de la plantilla. Es un cierre propio de la invitación: sin navegación ni menú del producto.
 */
export function FooterSection({ invitation, template, section, index }: SectionProps) {
  return (
    <SectionShell
      section={section}
      template={template}
      index={index}
      decor={["sectionTopLeft", "sectionBottomRight"]}
      decorSize="lg"
      contentClassName="py-24 text-center md:py-32"
    >
      <footer className="inv-reveal flex flex-col items-center gap-3">
        <p className="font-inv-display text-[2.25rem] leading-tight font-medium text-inv-ink italic md:text-5xl">{displayNames(invitation.names).join(" & ")}</p>
        <Divider kind={template.componentStyles.divider} />
        <p className="font-inv-body text-xs tracking-[0.32em] text-inv-accent md:text-sm">
          {formatCompactDate(invitation.event.startsAt, invitation.event.timezone)}
        </p>
        <p className="mt-3 max-w-[13rem] font-inv-body text-[0.6875rem] leading-relaxed tracking-[0.24em] text-inv-ink-muted uppercase md:max-w-[16rem] md:text-xs">
          {invitation.closing.message}
        </p>
      </footer>
    </SectionShell>
  );
}
