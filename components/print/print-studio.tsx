"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { ToggleRow } from "@/components/editor/fields/toggle-row";
import { OptionCardGroup } from "@/components/editor/fields/option-card-group";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, fieldErrorId, fieldHintId } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { printCopy } from "@/lib/print/copy";
import { parseInitials } from "@/lib/print/data";
import { cleanPlaceInput } from "@/lib/print/place";
import { PRINT_FORMAT_SPECS, PRINT_FORMATS, type PrintFormat } from "@/lib/print/formats";
import { DEFAULT_PRINT_OPTIONS, printOptionsQuery, type PreviewSide, type PrintOptions } from "@/lib/print/options";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const copy = printCopy.page;

/** Medidas en píxeles de cada vista previa (las del PNG que sirve el servidor, para reservar el espacio sin saltos). */
const PREVIEW_PX_PER_PT = 2.6;
function previewSize(side: PreviewSide, format: PrintFormat) {
  if (side === "envelope") return { width: Math.round(216 * PREVIEW_PX_PER_PT), height: Math.round(216 * PREVIEW_PX_PER_PT) };
  const spec = PRINT_FORMAT_SPECS[format];
  return { width: Math.round(spec.width * PREVIEW_PX_PER_PT), height: Math.round(spec.height * PREVIEW_PX_PER_PT) };
}

function Preview({ eventId, side, options, label, envelope = false }: { eventId: string; side: PreviewSide; options: PrintOptions; label: string; envelope?: boolean }) {
  const src = routes.eventPrintPreview(eventId, printOptionsQuery(options, { side }));
  const { width, height } = previewSize(side, options.format);
  return (
    <figure className="flex flex-col gap-3">
      <div className={cn("overflow-hidden rounded-lu-xs", envelope ? "mx-auto w-full max-w-xs bg-lu-surface-tint p-6 shadow-lu-card" : "bg-lu-surface-tint shadow-lu-card")}>
        {/* La vista previa ES el arte del PDF (misma composición), rasterizada y con marca de agua. */}
        <Image key={src} src={src} alt={`${label}: vista previa`} width={width} height={height} unoptimized className="block h-auto w-full" />
      </div>
      <figcaption className="text-center text-lu-sm text-lu-text-muted">{label}</figcaption>
    </figure>
  );
}

/**
 * VERSIÓN PARA IMPRIMIR (D-47): vistas previas del frente, el reverso y el monograma del sobre; a la derecha (debajo en móvil) las opciones y
 * el complemento.
 * Cada cambio pide imágenes nuevas al servidor (la composición vive allí: misma que el PDF). Pantalla aprobada sin mockup.
 */
export function PrintStudio({ eventId, qrAvailable, defaultInitials, defaultPlace, canDownload, product }: { eventId: string; qrAvailable: boolean; defaultInitials: string; defaultPlace: string; canDownload: boolean; product: ReactNode }) {
  const [options, setOptions] = useState<PrintOptions>({ ...DEFAULT_PRINT_OPTIONS, includeQr: qrAvailable });
  const [initialsText, setInitialsText] = useState(defaultInitials);
  const initialsInvalid = initialsText.trim() !== "" && !parseInitials(initialsText);

  const update = (patch: Partial<PrintOptions>) => setOptions((current) => ({ ...current, ...patch }));
  const onInitials = (value: string) => {
    setInitialsText(value);
    const parsed = parseInitials(value);
    // Vacío = las iniciales de los nombres; inválido = se conserva la última válida (la vista previa no parpadea).
    if (value.trim() === "")
      setOptions((current) => {
        const next = { ...current };
        delete next.initials;
        return next;
      });
    else if (parsed) update({ initials: parsed });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-label="Vista previa" className="flex flex-col gap-8">
        <Preview eventId={eventId} side="front" options={options} label={copy.previews.front} />
        {options.includeBack ? <Preview eventId={eventId} side="back" options={options} label={copy.previews.back} /> : null}
        <Preview eventId={eventId} side="envelope" options={options} label={copy.previews.envelope} envelope />
        <p className="text-center text-lu-sm text-lu-text-muted">{copy.previewNote}</p>
      </section>

      <aside className="flex flex-col gap-6">
        <Card className="flex flex-col gap-6">
          <h2 className="font-lu-display text-lu-title-sm text-lu-text">{copy.options.legend}</h2>
          <OptionCardGroup<PrintFormat>
            name="print-format"
            legend={copy.options.format}
            value={options.format}
            options={PRINT_FORMATS.map((format) => ({ value: format, label: `${PRINT_FORMAT_SPECS[format].label} · ${PRINT_FORMAT_SPECS[format].size}` }))}
            onChange={(format) => update({ format })}
          />
          <ToggleRow id="print-back" label={copy.options.back} hint={copy.options.backHint} checked={options.includeBack} onChange={(includeBack) => update({ includeBack })} />
          <ToggleRow
            id="print-qr"
            label={copy.options.qr}
            hint={qrAvailable ? copy.options.qrHint : copy.options.qrUnavailable}
            checked={qrAvailable && options.includeBack && options.includeQr}
            disabled={!qrAvailable || !options.includeBack}
            onChange={(includeQr) => update({ includeQr })}
          />
          <Field htmlFor="print-place" label={copy.options.place} hint={copy.options.placeHint}>
            <Input
              id="print-place"
              defaultValue={defaultPlace}
              maxLength={60}
              autoComplete="off"
              aria-describedby={fieldHintId("print-place")}
              onBlur={(event) => update({ place: cleanPlaceInput(event.target.value) })}
            />
          </Field>
          <Field htmlFor="print-initials" label={copy.options.initials} hint={copy.options.initialsHint} {...(initialsInvalid ? { error: copy.options.initialsInvalid } : {})}>
            <Input
              id="print-initials"
              value={initialsText}
              maxLength={5}
              autoComplete="off"
              invalid={initialsInvalid}
              aria-describedby={initialsInvalid ? fieldErrorId("print-initials") : fieldHintId("print-initials")}
              onChange={(event) => onInitials(event.target.value)}
              className="max-w-32 uppercase"
            />
          </Field>
        </Card>

        {canDownload ? (
          <Card variant="tint" className="flex flex-col gap-4">
            <ToggleRow id="print-marks" label={printCopy.page.product.cropMarks} hint={copy.product.adminNote} checked={options.cropMarks} onChange={(cropMarks) => update({ cropMarks })} />
            <Button asChild variant="secondary" fullWidth>
              <a href={routes.eventPrintFile(eventId, printOptionsQuery(options))} download>
                {copy.product.adminDownload}
              </a>
            </Button>
          </Card>
        ) : null}
        {product}
      </aside>
    </div>
  );
}
