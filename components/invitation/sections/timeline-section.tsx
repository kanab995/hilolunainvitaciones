import { Church, GlassWater, Music, PartyPopper, Sparkles, UtensilsCrossed } from "lucide-react";
import type { ComponentType } from "react";
import { EditorPlaceholder } from "@/components/invitation/primitives/editor-placeholder";
import { SectionHeading } from "@/components/invitation/primitives/section-heading";
import { SectionShell } from "@/components/invitation/primitives/section-shell";
import type { SectionProps } from "@/components/invitation/sections/types";
import { invitationCopy } from "@/lib/invitation/copy";
import { cn } from "@/lib/utils";
import type { TimelineItem } from "@/types/invitation";

type IconComponent = ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: "true" }>;

const icons: Record<TimelineItem["icon"], IconComponent> = {
  ceremony: Church,
  cocktail: GlassWater,
  dinner: UtensilsCrossed,
  party: Music,
  toast: PartyPopper,
  other: Sparkles,
};

/**
 * ITINERARIO (`invitation.timeline`). `template.layout.timeline`:
 *  - `horizontal` (mockup 06): íconos sobre una línea, hora y etiqueta debajo. En pantallas muy
 *    estrechas el conjunto se desplaza en horizontal con suavidad en lugar de comprimirse.
 *  - `vertical`: lista con línea lateral.
 * El contenido es el mismo en ambas.
 */
export function TimelineSection({ invitation, template, section, index, editing }: SectionProps) {
  // Un momento sin nombre no se dibuja; sin ninguno, la sección se oculta hasta tener contenido.
  const items = invitation.timeline.filter((item) => item.label.trim());
  if (items.length === 0) return editing ? <EditorPlaceholder section={section} template={template} index={index} message={invitationCopy.editorEmpty.timeline} /> : null;
  const vertical = template.layout.timeline === "vertical";
  return (
    <SectionShell
      section={section}
      template={template}
      index={index}
      decor={["sectionTopRight", "sectionBottomLeft"]}
      decorSize="sm"
      width="wide"
      contentClassName="py-14 md:py-20"
    >
      <div className="inv-reveal flex flex-col gap-9">
        <SectionHeading section={section} template={template} fallbackTitle={invitationCopy.sections.timeline} subtitleCase="upper" />
        <div className={cn(!vertical && "-mx-(--inv-gutter) overflow-x-auto px-(--inv-gutter) pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:overflow-visible md:px-0")}>
          <ol
            data-timeline-layout={vertical ? "vertical" : "horizontal"}
            className={cn(vertical ? "flex flex-col gap-6 border-l border-inv-line pl-6" : "relative mx-auto flex min-w-[20rem] max-w-[34rem] justify-between gap-1 md:grid md:min-w-0 md:max-w-[56rem] md:grid-cols-[repeat(5,minmax(7.5rem,1fr))] md:gap-x-3")}
          >
            {!vertical ? <span aria-hidden="true" className="absolute top-[1.375rem] right-[10%] left-[10%] h-px bg-inv-line" /> : null}
            {items.map((item) => {
              const Icon = icons[item.icon];
              return (
                <li key={item.id} className={cn("relative", vertical ? "flex items-center gap-4" : "flex w-[20%] min-w-0 flex-col items-center gap-2.5 text-center md:w-auto md:gap-6")}>
                  <span
                    className={cn(
                      "relative inline-flex size-11 items-center justify-center bg-inv-bg text-inv-accent",
                      vertical && "-ml-[3.125rem] rounded-full border border-inv-line",
                    )}
                  >
                    <Icon aria-hidden="true" className="size-6" strokeWidth={1.25} />
                  </span>
                  <span className={cn("flex min-w-0 flex-col gap-0.5", vertical ? "items-start" : "items-center md:gap-2")}>
                    <span className="font-inv-body text-[0.8125rem] font-medium text-inv-ink md:text-sm">{item.time}</span>
                    <span className={cn("font-inv-body text-[0.75rem] leading-snug text-inv-ink-muted md:text-[0.875rem]", !vertical && "md:mx-auto md:max-w-[9.375rem] md:text-balance")}>{item.label}</span>
                    {item.description ? <span className="font-inv-body text-[0.6875rem] text-inv-ink-muted">{item.description}</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </SectionShell>
  );
}
