import { Divider } from "@/components/invitation/primitives/divider";
import { SectionHeading } from "@/components/invitation/primitives/section-heading";
import { EditorPlaceholder } from "@/components/invitation/primitives/editor-placeholder";
import { SectionShell } from "@/components/invitation/primitives/section-shell";
import type { SectionProps } from "@/components/invitation/sections/types";
import { invitationCopy } from "@/lib/invitation/copy";

/** NUESTRA HISTORIA: el mensaje de la invitación (`invitation.story`). Sección ligera: título, texto y una esquina floral. */
export function StorySection({ invitation, template, section, index, editing }: SectionProps) {
  const paragraphs = invitation.story.paragraphs.filter((paragraph) => paragraph.trim());
  if (paragraphs.length === 0) return editing ? <EditorPlaceholder section={section} template={template} index={index} message={invitationCopy.editorEmpty.story} /> : null;
  return (
    <SectionShell
      section={section}
      template={template}
      index={index}
      decor={["sectionTopLeft", "sectionBottomRight"]}
      contentClassName="py-16 text-center md:py-24"
    >
      <div className="inv-reveal flex flex-col items-center gap-6">
        <SectionHeading section={section} template={template} fallbackTitle={invitationCopy.sections.story} />
        <div className="flex flex-col gap-4 font-inv-body text-[0.9375rem] leading-[1.7] text-inv-ink-muted md:text-base">
          {paragraphs.map((paragraph, i) => (
            <p key={i} className="text-pretty whitespace-pre-line">
              {paragraph}
            </p>
          ))}
        </div>
        <Divider kind={template.componentStyles.divider} className="mt-2" />
      </div>
    </SectionShell>
  );
}
