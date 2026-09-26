"use client";

import { Download } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/share/download";
import { createQrMatrix, qrPayload, qrToPngBlob, qrToSvg } from "@/lib/share/qr";
import { cn } from "@/lib/utils";

/**
 * CÓDIGO QR de una URL (D-30): se dibuja en local (sin servicios externos), en tinta oscura sobre blanco y con zona
 * de silencio, a ~272 px (escaneable desde otro teléfono). «Descargar QR» exporta un PNG de 1024 px (nítido para
 * imprimir) y, opcionalmente, un SVG. Accesibilidad: la imagen se describe como «Código QR para abrir la invitación»
 * (no se intenta leer el patrón) y el resultado de la descarga se anuncia en una región `status`.
 * No muestra la URL ni ningún token: quien lo necesita la muestra aparte (o no).
 */
export function QrCodePanel({
  url,
  filename,
  svgFilename,
  label = "Código QR para abrir la invitación",
  className,
}: {
  url: string;
  /** Nombre del PNG (ya saneado, p. ej. `invitacion-andrea-y-fernando-qr.png`). */
  filename: string;
  /** Si se indica, se ofrece también la descarga en SVG. */
  svgFilename?: string;
  label?: string;
  className?: string;
}) {
  const qr = useMemo(() => {
    try {
      const matrix = createQrMatrix(qrPayload(url));
      return { matrix, svg: qrToSvg(matrix) };
    } catch {
      return undefined;
    }
  }, [url]);

  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string }>();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const announce = (tone: "ok" | "error", text: string) => {
    setMessage({ tone, text });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(undefined), 3000);
  };

  const downloadPng = async () => {
    if (!qr) return;
    try {
      downloadBlob(await qrToPngBlob(qr.matrix), filename);
      announce("ok", "QR descargado ✓");
    } catch {
      announce("error", "No pudimos descargar el QR. Inténtalo de nuevo.");
    }
  };

  const downloadSvg = () => {
    if (!qr || !svgFilename) return;
    downloadBlob(new Blob([qr.svg], { type: "image/svg+xml" }), svgFilename);
    announce("ok", "QR descargado ✓");
  };

  if (!qr) {
    return (
      <p role="alert" className={cn("text-lu-sm text-lu-error", className)}>
        No pudimos generar el código QR. Usa el enlace para compartir la invitación.
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="rounded-lu-card border border-lu-border-subtle bg-white p-3 shadow-lu-card">
        <div role="img" aria-label={label} data-qr-modules={qr.matrix.size} className="aspect-square w-[min(68vw,17rem)] [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qr.svg }} />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={downloadPng}>
          <Download aria-hidden="true" />
          Descargar QR
        </Button>
        {svgFilename ? (
          <Button variant="ghost" onClick={downloadSvg} aria-label="Descargar QR en formato SVG">
            SVG
          </Button>
        ) : null}
      </div>
      <p role="status" className={cn("min-h-5 text-lu-sm", message?.tone === "error" ? "text-lu-error" : "text-lu-text-muted")}>
        {message?.text}
      </p>
    </div>
  );
}
