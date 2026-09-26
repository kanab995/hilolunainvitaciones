import { ArrowUpRight } from "lucide-react";
import { InvButton } from "@/components/invitation/primitives/inv-button";
import { InvImage, photoMaskClass } from "@/components/invitation/primitives/inv-image";
import { SectionHeading } from "@/components/invitation/primitives/section-heading";
import { SectionShell } from "@/components/invitation/primitives/section-shell";
import type { SectionProps } from "@/components/invitation/sections/types";
import { invitationCopy } from "@/lib/invitation/copy";
import { cn } from "@/lib/utils";

/**
 * MESA DE REGALOS (`invitation.giftRegistry`). Las tiendas se muestran solo con su nombre (sin
 * logos de terceros, CLAUDE.md §7) y son enlaces externos neutrales.
 */
export function GiftRegistrySection({ invitation, template, section, index }: SectionProps) {
  const { giftRegistry } = invitation;
  // Sin tiendas, mensaje ni enlace no hay nada que mostrar (la sección se oculta hasta tener contenido).
  if (!giftRegistry || (giftRegistry.entries.length === 0 && !giftRegistry.message.trim() && !giftRegistry.moreUrl)) return null;
  const { border: cardBorder, shadow: cardShadow } = template.componentStyles.card;
  const fadeLeft = photoMaskClass(template.effects.photoMask ?? "none", "left");

  return (
    <SectionShell section={section} template={template} index={index} width="bleed" contentClassName="py-12 md:py-20">
      <div className="inv-reveal mx-auto grid w-full max-w-(--inv-wide-max) grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-stretch gap-2 md:grid-cols-2 md:gap-10">
        <div className="flex flex-col gap-4 pl-5 md:justify-center md:gap-5 md:pl-14">
          <SectionHeading section={section} template={template} fallbackTitle={invitationCopy.sections.giftRegistry} align="left" />
          <p className="max-w-[20rem] font-inv-body text-[0.8125rem] leading-relaxed text-inv-ink-muted md:text-[0.9375rem]">{giftRegistry.message}</p>
          <ul className="flex flex-wrap gap-2.5">
            {giftRegistry.entries.map((entry) => (
              <li key={entry.id}>
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex h-11 items-center gap-1.5 rounded-(--inv-radius-card) bg-inv-bg px-4 font-inv-body text-sm font-medium text-inv-ink outline-none",
                    "focus-visible:ring-2 focus-visible:ring-inv-accent",
                    cardBorder && "border border-inv-line",
                    cardShadow && "shadow-sm",
                  )}
                >
                  {entry.name}
                  <ArrowUpRight aria-hidden="true" className="size-3.5 text-inv-accent" strokeWidth={1.5} />
                  <span className="sr-only"> (se abre en una pestaña nueva)</span>
                </a>
              </li>
            ))}
          </ul>
          {giftRegistry.moreUrl ? (
            <InvButton href={giftRegistry.moreUrl} target="_blank" rel="noopener noreferrer" variant="outline" arrow className="self-start">
              {invitationCopy.moreOptions}
              <span className="sr-only"> (se abre en una pestaña nueva)</span>
            </InvButton>
          ) : null}
        </div>
        <InvImage
          image={giftRegistry.photo}
          sizes="(min-width: 1024px) 512px, (min-width: 768px) 50vw, 40vw"
          className={cn("min-h-[17rem] w-full md:min-h-[26rem]", fadeLeft)}
        />
      </div>
    </SectionShell>
  );
}
