import { CircleHelp, Clock, FileText, Gift, Image as ImageIcon, MapPin, Music } from "lucide-react";
import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/typography";
import { templateDetailCopy, templateFeatureCopy } from "@/lib/content/templates";
import { cn } from "@/lib/utils";
import type { TemplateFeatureId } from "@/types/templates";

const featureIcons: Record<TemplateFeatureId, ReactNode> = {
  music: <Music />,
  rsvp: <FileText />,
  gallery: <ImageIcon />,
  countdown: <Clock />,
  location: <MapPin />,
  gifts: <Gift />,
};

/**
 * "INCLUYE EN TU INVITACIÓN" (mockup 03): rejilla de 2 columnas con las funciones que incluye una
 * plantilla (ícono en cuadro suave, título serif y descripción). Recibe la lista de funciones, así
 * que sirve para cualquier plantilla.
 */
export function TemplateFeatureList({
  features,
  className,
}: {
  features: readonly TemplateFeatureId[];
  className?: string;
}) {
  return (
    <section aria-labelledby="template-features-title" className={cn("flex flex-col gap-4", className)}>
      <Eyebrow id="template-features-title">{templateDetailCopy.featuresTitle}</Eyebrow>
      <ul className="grid gap-3 sm:grid-cols-2">
        {features.map((id) => {
          const copy = templateFeatureCopy[id];
          return (
            <li
              key={id}
              className="flex items-center gap-4 rounded-lu-button-lg border border-lu-border-subtle bg-lu-surface px-4 py-3.5"
            >
              <span
                aria-hidden="true"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-lu-input bg-lu-surface-tint text-lu-brown-500 [&_svg]:size-5 [&_svg]:stroke-[1.5]"
              >
                {featureIcons[id] ?? <CircleHelp />}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-lu-display text-lu-title-sm leading-tight text-lu-text">{copy.title}</span>
                <span className="text-lu-sm leading-snug text-lu-text-muted">{copy.description}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
