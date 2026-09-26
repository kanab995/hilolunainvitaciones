import { AlignCenter, Image as ImageIcon, Link2, MessageCircle, MousePointer2, Share2 } from "lucide-react";
import type { ReactNode } from "react";
import { PhoneFrame } from "@/components/marketing/phone-frame";
import { MediaSlot } from "@/components/ui/media-slot";
import type { HowItWorksVisualId } from "@/types/marketing";

/**
 * Composiciones editoriales de los pasos de "Así de fácil": objetos superpuestos con sombras,
 * rotaciones y escenas difusas (no íconos). Todo decorativo y hecho con tokens.
 * TODO(asset): replace with approved Hilo Luna asset — las miniaturas de invitación y de foto que
 * aparecen en el mockup 01 (hoy son placeholders con escena).
 */

/** Paso 1: abanico de cuatro tarjetas de invitación con la principal al frente. */
function TemplateStackVisual() {
  return (
    <div className="relative h-44 w-60">
      {/* Tarjeta oscura (fondo negro/mármol del mockup) */}
      <span className="absolute top-6 left-0 h-[8.25rem] w-[5.5rem] -rotate-[13deg] rounded-lu-image bg-lu-ink shadow-lu-card">
        <span className="absolute inset-2 rounded-lu-xs border border-lu-brown-400/50" />
      </span>
      <MediaSlot
        tone="sage"
        scene="petals"
        className="absolute top-3 left-[3.25rem] h-[8.25rem] w-[5.5rem] -rotate-[6deg] rounded-lu-image shadow-lu-card"
      />
      <MediaSlot
        tone="blush"
        scene="roses"
        flip
        className="absolute top-5 right-1 h-[8.25rem] w-[5.5rem] rotate-[10deg] rounded-lu-image shadow-lu-card"
      />
      {/* Tarjeta principal */}
      <span className="absolute top-0 left-1/2 flex h-[9.5rem] w-[6.5rem] -translate-x-1/2 -rotate-[2deg] flex-col items-center justify-center gap-1 overflow-hidden rounded-lu-image border border-lu-border-subtle bg-lu-surface shadow-lu-float">
        <MediaSlot
          tone="blush"
          scene="petals"
          className="absolute inset-x-0 top-0 h-[38%] [mask-image:linear-gradient(to_bottom,#000_55%,transparent)]"
        />
        <span className="relative text-[0.4375rem] font-medium tracking-[0.22em] text-lu-eyebrow uppercase">
          Nos casamos
        </span>
        <span className="relative flex flex-col items-center font-lu-display text-[1.0625rem] leading-[1.05] font-medium text-lu-brown-600 italic">
          <span>Andrea</span>
          <span className="text-[0.75rem]">&amp;</span>
          <span>Fernando</span>
        </span>
        <span className="relative mt-1 h-px w-6 bg-lu-brown-400/60" />
      </span>
    </div>
  );
}

/** Paso 2: barra de herramientas de edición y la foto que se está editando. */
function EditorVisual() {
  return (
    <div className="relative h-44 w-60">
      <MediaSlot
        tone="blush"
        scene="roses"
        className="absolute top-1 right-0 h-[9.5rem] w-[7.75rem] rotate-[3deg] rounded-lu-button-lg shadow-lu-float"
      />
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

/** Paso 3: teléfono con la invitación, accesos de compartir (genéricos) y el mensaje recibido. */
function ShareVisual() {
  return (
    <div className="relative h-44 w-60">
      <PhoneFrame size="sm" className="absolute top-0 left-6 h-[9.75rem] w-auto">
        <MediaSlot tone="cream" scene="roses" className="size-full">
          <span className="absolute inset-x-0 top-[38%] flex flex-col items-center font-lu-display text-[0.8125rem] leading-[1.05] font-medium text-lu-brown-600 italic">
            <span>Andrea</span>
            <span>Fernando</span>
          </span>
        </MediaSlot>
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
