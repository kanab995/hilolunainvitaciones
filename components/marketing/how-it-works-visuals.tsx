import Image from "next/image";
import { AlignCenter, Image as ImageIcon, Link2, MessageCircle, MousePointer2, Share2 } from "lucide-react";
import type { ReactNode } from "react";
import { PhoneFrame } from "@/components/marketing/phone-frame";
import { TemplateThumbCard } from "@/components/marketing/template-thumb-card";
import { CoverScreen } from "@/components/templates/preview-screens";
import { heroInvitationDemo } from "@/lib/content/home";
import { getTemplateCoverImage } from "@/lib/templates/status";
import type { HowItWorksVisualId } from "@/types/marketing";

/**
 * Composiciones editoriales de los pasos de "Así de fácil": objetos superpuestos con sombras y
 * rotaciones, con las portadas reales de las plantillas listas (`getTemplateCoverImage`) en vez de
 * degradados o texto plano. Sin alguna plantilla, su tarjeta sencillamente no se dibuja (nunca un
 * hueco con placeholder de repuesto: estas composiciones son decorativas, no listan el catálogo).
 */

/** Paso 1: abanico con las portadas reales de las 4 plantillas listas, Magnolia al frente. */
function TemplateStackVisual() {
  const magnolia = getTemplateCoverImage("magnolia");
  const level12 = getTemplateCoverImage("level-12");
  const auroraXv = getTemplateCoverImage("aurora-xv");
  const celeste = getTemplateCoverImage("celeste");

  return (
    <div className="relative h-44 w-60">
      {level12 ? (
        <TemplateThumbCard src={level12.src} className="top-6 left-0 h-[8.25rem] w-[5.5rem] -rotate-[13deg]" />
      ) : null}
      {auroraXv ? (
        <TemplateThumbCard src={auroraXv.src} className="top-3 left-[3.25rem] h-[8.25rem] w-[5.5rem] -rotate-[6deg]" />
      ) : null}
      {celeste ? (
        <TemplateThumbCard src={celeste.src} className="top-5 right-1 h-[8.25rem] w-[5.5rem] rotate-[10deg]" />
      ) : null}
      {/* Tarjeta principal: Magnolia, con el mismo texto de muestra del hero (su portada tiene el centro despejado para texto). */}
      <span className="@container absolute top-0 left-1/2 block h-[9.5rem] w-[6.5rem] -translate-x-1/2 -rotate-[2deg] overflow-hidden rounded-lu-image border border-lu-border-subtle bg-lu-surface shadow-lu-float">
        <CoverScreen
          sample={heroInvitationDemo}
          backgroundImage={magnolia ? { src: magnolia.src, alt: "" } : undefined}
        />
      </span>
    </div>
  );
}

/** Paso 2: barra de herramientas de edición y la foto real de Aurora XV que se está editando. */
function EditorVisual() {
  const auroraXv = getTemplateCoverImage("aurora-xv");
  return (
    <div className="relative h-44 w-60">
      {auroraXv ? (
        <TemplateThumbCard src={auroraXv.src} className="top-1 right-0 h-[9.5rem] w-[7.75rem] rotate-[3deg] rounded-lu-button-lg" />
      ) : null}
      <div className="absolute top-6 left-0 w-[10.5rem] rounded-lu-button-lg border border-lu-border-subtle bg-lu-surface p-3.5 shadow-lu-float">
        <div className="flex items-center gap-2.5 text-lu-text-secondary">
          <span className="font-lu-display text-lu-title-sm leading-none">Aa</span>
          <span className="h-4 w-px bg-lu-border" />
          <AlignCenter className="size-4" strokeWidth={1.5} />
          <ImageIcon className="size-4" strokeWidth={1.5} />
        </div>
        <div className="mt-3.5 flex items-center gap-2">
          <span className="size-[1.125rem] rounded-full bg-lu-brown-500 ring-2 ring-lu-brown-500/25 ring-offset-2 ring-offset-lu-surface" />
          <span className="size-[1.125rem] rounded-full bg-lu-blush" />
          <span className="size-[1.125rem] rounded-full bg-lu-sage" />
        </div>
        <div className="mt-3.5 flex items-center">
          <span className="h-1 flex-1 rounded-full bg-lu-border" />
          <span className="-ml-9 size-3 rounded-full border-2 border-lu-brown-500 bg-lu-surface" />
        </div>
      </div>
      <MousePointer2
        strokeWidth={1.5}
        className="absolute right-5 bottom-3 size-7 fill-lu-ink text-lu-on-ink drop-shadow-md"
      />
    </div>
  );
}

/** Paso 3: teléfono con la portada real de Celeste publicada, accesos de compartir (genéricos) y el mensaje recibido. */
function ShareVisual() {
  const celeste = getTemplateCoverImage("celeste");
  return (
    <div className="relative h-44 w-60">
      <PhoneFrame size="sm" className="absolute top-0 left-6 h-[9.75rem] w-auto">
        {celeste ? (
          <Image src={celeste.src} alt="" fill sizes="110px" className="object-cover" />
        ) : null}
      </PhoneFrame>
      <div className="absolute top-1 right-3 flex flex-col items-center gap-2.5 text-lu-on-ink">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-lu-success shadow-lu-card [&_svg]:size-[1.125rem]">
          <MessageCircle strokeWidth={1.75} />
        </span>
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-lu-brown-500 shadow-lu-card [&_svg]:size-[1.125rem]">
          <Share2 strokeWidth={1.75} />
        </span>
        <span className="inline-flex size-9 items-center justify-center rounded-full border border-lu-border bg-lu-surface text-lu-text shadow-lu-card [&_svg]:size-[1.125rem]">
          <Link2 strokeWidth={1.75} />
        </span>
      </div>
      <span className="absolute bottom-1 left-[4.5rem] rounded-lu-button border border-lu-border-subtle bg-lu-surface px-3.5 py-2 font-lu-display text-lu-title-sm whitespace-nowrap text-lu-text italic shadow-lu-float">
        ¡Estás invitado!
      </span>
    </div>
  );
}

const visuals: Record<HowItWorksVisualId, ReactNode> = {
  "template-stack": <TemplateStackVisual />,
  editor: <EditorVisual />,
  share: <ShareVisual />,
};

/**
 * En 1024–1279 px las tres columnas son estrechas: la composición se reduce (≈ 78 %, anclada a la
 * derecha) para no chocar con el numeral. A partir de `xl` y en tablet/móvil va a tamaño completo.
 */
export function HowItWorksVisual({ id }: { id: HowItWorksVisualId }) {
  return <div className="origin-right lg:scale-[0.78] xl:scale-100">{visuals[id]}</div>;
}
