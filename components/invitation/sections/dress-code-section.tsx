import { EditorPlaceholder } from "@/components/invitation/primitives/editor-placeholder";
import { InvImage, photoMaskClass } from "@/components/invitation/primitives/inv-image";
import { SectionHeading } from "@/components/invitation/primitives/section-heading";
import { SectionShell } from "@/components/invitation/primitives/section-shell";
import type { SectionProps } from "@/components/invitation/sections/types";
import { invitationCopy } from "@/lib/invitation/copy";
import { cn } from "@/lib/utils";

/**
 * DRESS CODE (`invitation.dressCode`). Sin datos no se dibuja (regla 17: nada se borra, solo no
 * hay qué mostrar). La paleta es contenido del usuario: sus colores vienen de los datos, son
 * decorativos y cada uno lleva nombre accesible y texto para lectores (el color no es la única señal).
 * La ilustración (acuarela, no fotografía) se mezcla con el fondo (`multiply`) y se desvanece hacia el texto.
 */
export function DressCodeSection({ invitation, template, section, index, editing }: SectionProps) {
  const { dressCode } = invitation;
  // Sin estilo, descripción, paleta ni ilustración no hay nada que mostrar al invitado.
  const empty = !dressCode || (!dressCode.style.trim() && !dressCode.description.trim() && dressCode.palette.length === 0 && !dressCode.illustration?.src);
  if (empty) return editing ? <EditorPlaceholder section={section} template={template} index={index} message={invitationCopy.editorEmpty.dressCode} /> : null;

  return (
    <SectionShell
      section={section}
      template={template}
      index={index}
      width="bleed"
      contentClassName="py-12 md:py-20"
    >
      <div className="inv-reveal mx-auto grid w-full max-w-(--inv-wide-max) grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-center gap-2 md:grid-cols-2 md:gap-10">
        <div className="flex flex-col gap-4 pl-5 md:items-start md:gap-5 md:pl-14">
          <SectionHeading
            section={section}
            template={template}
            fallbackTitle={dressCode.style || invitationCopy.sections.dressCode}
            align="left"
          />
          <p className="max-w-[20rem] font-inv-body text-[0.8125rem] leading-relaxed text-inv-ink-muted md:text-[0.9375rem]">{dressCode.description}</p>
          <ul aria-label="Paleta sugerida" className="flex gap-2.5">
            {dressCode.palette.map((swatch) => (
              <li key={swatch.hex}>
                <span
                  role="img"
                  aria-label={swatch.name ?? swatch.hex}
                  title={swatch.name}
                  className="block size-8 rounded-full border border-inv-line md:size-9"
                  style={{ backgroundColor: swatch.hex }}
                />
                <span className="sr-only">{swatch.name ?? swatch.hex}</span>
              </li>
            ))}
          </ul>
        </div>
        <InvImage
          image={dressCode.illustration}
          blend
          sizes="(min-width: 1024px) 512px, (min-width: 768px) 50vw, 46vw"
          className={cn("aspect-[4/5] w-full", photoMaskClass(template.effects.photoMask ?? "none", "left"))}
        />
      </div>
    </SectionShell>
  );
}
