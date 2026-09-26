"use client";

import { Lightbulb, Monitor, Smartphone } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useElementSize } from "@/components/editor/use-element-size";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isPreviewReadyMessage, PREVIEW_DRAFT_MESSAGE } from "@/lib/editor/preview-channel";
import type { Invitation } from "@/types/invitation";

type Device = "mobile" | "desktop";

/** Viewport real con el que se dibuja la invitación en cada dispositivo (px CSS). */
const VIEWPORTS: Record<Device, { width: number; height: number; bezel: number }> = {
  mobile: { width: 390, height: 844, bezel: 8 },
  desktop: { width: 1280, height: 800, bezel: 0 },
};

/**
 * `<iframe>` de `/preview/[id]`: dentro corre el MISMO `InvitationRenderer` que la página pública. El
 * borrador se le envía por `postMessage` en cada cambio (cuando avisa de que está listo). Tiene su
 * propio scroll, independiente del editor.
 */
function PreviewIframe({ src, title, draft, style }: { src: string; title: string; draft: Invitation; style: CSSProperties }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === ref.current?.contentWindow && isPreviewReadyMessage(event.data)) setReady(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    ref.current?.contentWindow?.postMessage({ type: PREVIEW_DRAFT_MESSAGE, invitation: draft }, window.location.origin);
  }, [draft, ready]);

  return <iframe ref={ref} src={src} title={title} loading="eager" className="block border-0 bg-transparent" style={style} />;
}

interface Fit {
  ready: boolean;
  width: number;
  height: number;
  /** 1 = tamaño real (sin transform). Solo el modo Escritorio se reduce. */
  scale: number;
}

const PHONE_ASPECT = 0.48;

/**
 * Móvil: el iframe usa DIMENSIONES REALES (sin `transform`): toma todo el alto disponible y su ancho
 * sigue la proporción de un teléfono (≈ 0,48), entre 320 y 390 px. Así el scroll y las interacciones
 * son nativos. Con espacio de sobra llega al tamaño real de un móvil (390 × 844).
 */
function fitPhone(area: { width: number; height: number }, bezel: number): Fit {
  if (area.width <= 0 || area.height <= 0) return { ready: false, width: 0, height: 0, scale: 1 };
  const availableWidth = area.width - bezel * 2;
  const height = Math.min(VIEWPORTS.mobile.height, area.height - bezel * 2);
  const width = Math.min(availableWidth, Math.min(VIEWPORTS.mobile.width, Math.max(320, Math.round(height * PHONE_ASPECT))));
  return { ready: true, width, height, scale: 1 };
}

/** Escritorio: un viewport de 1280 px no cabe en el panel, así que se reduce con `transform` para caber. */
function fitDesktop(area: { width: number; height: number }): Fit {
  if (area.width <= 0 || area.height <= 0) return { ready: false, width: 0, height: 0, scale: 1 };
  const { width, height } = VIEWPORTS.desktop;
  const scale = Math.min(1, area.width / width, area.height / height);
  return { ready: true, width, height, scale };
}

/**
 * VISTA PREVIA (mockup 04): selector Móvil / Escritorio y el dispositivo con la invitación real
 * dentro. El iframe conserva su viewport real (390 × 844 o 1280 × 800) y se ESCALA para caber en el
 * espacio disponible: las media queries de la invitación se comportan como en ese dispositivo.
 * `fluid` (móvil, pantalla completa): sin marco, el iframe ocupa todo el espacio a tamaño real.
 * No hay paginación "1 / N": la invitación es un scroll continuo y una paginación no tendría sentido.
 */
export function PreviewPanel({ eventId, draft, fluid = false }: { eventId: string; draft: Invitation; fluid?: boolean }) {
  const [device, setDevice] = useState<Device>("mobile");
  const areaRef = useRef<HTMLDivElement>(null);
  const area = useElementSize(areaRef);
  const src = `/preview/${eventId}`;

  if (fluid) {
    return (
      <div className="relative h-full w-full">
        <PreviewIframe src={src} title="Vista previa de la invitación en móvil" draft={draft} style={{ width: "100%", height: "100%" }} />
      </div>
    );
  }

  const bezel = VIEWPORTS[device].bezel;
  const fit = device === "mobile" ? fitPhone(area, bezel) : fitDesktop(area);
  const outer = { width: fit.width * fit.scale + bezel * 2, height: fit.height * fit.scale + bezel * 2 };
  const viewport = fit;

  return (
    <div className="flex h-full min-h-0 flex-col items-center gap-5">
      <Tabs value={device} onValueChange={(value) => setDevice(value as Device)} className="items-center">
        <TabsList variant="segmented" aria-label="Dispositivo de la vista previa">
          <TabsTrigger value="mobile">
            <Smartphone aria-hidden="true" />
            Móvil
          </TabsTrigger>
          <TabsTrigger value="desktop">
            <Monitor aria-hidden="true" />
            Escritorio
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div ref={areaRef} className="mt-1 flex min-h-0 w-full flex-1 items-start justify-center">
        {fit.ready ? (
          <div
            data-device={device}
            className={device === "mobile" ? "relative overflow-hidden rounded-[2.25rem] bg-lu-ink shadow-lu-device" : "relative overflow-hidden rounded-lu-card border border-lu-border bg-lu-surface shadow-lu-card"}
            style={{ ...outer, padding: bezel }}
          >
            <div className={device === "mobile" ? "relative h-full w-full overflow-hidden rounded-[1.75rem] bg-lu-surface" : "relative h-full w-full overflow-hidden"}>
              <PreviewIframe
                key={device}
                src={src}
                title={device === "mobile" ? "Vista previa de la invitación en móvil" : "Vista previa de la invitación en escritorio"}
                draft={draft}
                style={{ width: viewport.width, height: viewport.height, transform: fit.scale < 1 ? `scale(${fit.scale})` : undefined, transformOrigin: "top left" }}
              />
            </div>
            {device === "mobile" ? <span aria-hidden="true" className="pointer-events-none absolute top-2.5 left-1/2 h-4 w-16 -translate-x-1/2 rounded-full bg-lu-ink" /> : null}
          </div>
        ) : null}
      </div>

      <div className="flex w-full max-w-sm shrink-0 items-start gap-3 rounded-lu-card [@media(max-height:820px)]:hidden border border-lu-border-subtle bg-lu-surface-tint/60 p-3">
        <span aria-hidden="true" className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-lu-surface text-lu-brown-500">
          <Lightbulb className="size-4" strokeWidth={1.5} />
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="text-lu-sm font-medium text-lu-text">Vista en tiempo real</p>
          <p className="text-lu-xs text-lu-text-muted">Los cambios se aplican automáticamente en la vista previa.</p>
        </div>
      </div>
    </div>
  );
}
