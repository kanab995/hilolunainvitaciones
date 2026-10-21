"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { savePrintQrTargetAction } from "@/app/(site)/dashboard/(workspace)/events/[id]/print/actions";
import { printCopy } from "@/lib/print/copy";
import { isQrTargetAvailable, PRINT_QR_TARGETS, type PrintQrTarget } from "@/lib/print/qr-target";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { PrintQrView } from "@/server/services/print-service";

const copy = printCopy.page.qr;
const card = printCopy.card.qr;

const formatDate = (date: Date) => new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "America/Mexico_City" }).format(date);
const withoutScheme = (url: string) => url.replace(/^https?:\/\//, "");

/**
 * DESTINO DEL QR (D-49) en «Versión para imprimir»: invitación digital, mesa de regalos, enlace directo a la única tienda (si la hay y su
 * enlace es seguro) o sin QR. Radios nativos (teclado y lectores de pantalla). Cada cambio actualiza la vista previa al instante y se GUARDA
 * en el servidor (`PrintSettings`), que vuelve a comprobar que ese destino existe en la invitación publicada. Debajo, el texto que se
 * imprimirá, a dónde abre y de qué depende su vigencia.
 */
export function QrTargetPicker({ eventId, qr, value, includeBack, onChange }: { eventId: string; qr: PrintQrView; value: PrintQrTarget; includeBack: boolean; onChange: (target: PrintQrTarget) => void }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ tone: "ok" | "error"; message: string } | null>(qr.savedUnavailable ? { tone: "error", message: copy.savedUnavailable } : null);
  const { availability } = qr;
  // El enlace directo solo se ofrece con UNA tienda; con varias, la sección de regalos es la que deja elegir.
  const offered = PRINT_QR_TARGETS.filter((target) => target !== "gift-link" || availability.giftLink.ok || (availability.giftLink.reason !== "several" && availability.giftLink.reason !== "no_registry"));

  const choose = (target: PrintQrTarget) => {
    const previous = value;
    onChange(target);
    setStatus(null);
    startTransition(async () => {
      const result = await savePrintQrTargetAction(eventId, target);
      if (result.ok) setStatus({ tone: "ok", message: copy.saved });
      else {
        onChange(previous);
        setStatus({ tone: "error", message: result.message });
      }
    });
  };

  const description = (target: PrintQrTarget): string => {
    if (target === "invitation" && !availability.invitation) return copy.invitationUnavailable;
    if (target === "gift-link") return availability.giftLink.ok ? copy.giftLinkStore(availability.giftLink.name) : copy.giftLinkProblem[availability.giftLink.reason as keyof typeof copy.giftLinkProblem];
    return copy.options[target].description;
  };

  const opens = value === "invitation" ? qr.invitationUrl : value === "gifts" ? qr.giftsUrl : value === "gift-link" && availability.giftLink.ok ? availability.giftLink.url : null;

  return (
    <fieldset className="flex flex-col gap-3" disabled={!includeBack} aria-describedby="print-qr-hint">
      <legend className="text-lu-sm font-medium text-lu-text">{copy.legend}</legend>
      <p id="print-qr-hint" className="-mt-1 text-lu-sm text-lu-text-muted">
        {includeBack ? copy.hint : copy.noBack}
      </p>

      <div className="flex flex-col gap-2">
        {offered.map((target) => {
          const available = isQrTargetAvailable(target, availability);
          const checked = includeBack && value === target;
          return (
            <label
              key={target}
              data-qr-target={target}
              data-available={available}
              className={cn(
                "flex items-start gap-3 rounded-lu-card border bg-lu-surface p-3 transition-[border-color,background-color] duration-150 ease-lu-standard",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-lu-brown-600 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-lu-canvas",
                available && includeBack ? "cursor-pointer" : "cursor-not-allowed opacity-60",
                checked ? "border-lu-brown-600 bg-lu-nav-active" : "border-lu-border-subtle",
              )}
            >
              <input type="radio" name="print-qr-target" value={target} checked={checked} disabled={!available || !includeBack || pending} onChange={() => choose(target)} className="mt-1 size-4 accent-[var(--lu-brown-600)]" />
              <span className="flex flex-col gap-0.5">
                <span className="text-lu-sm font-medium text-lu-text">{copy.options[target].label}</span>
                <span className="text-lu-xs text-lu-text-secondary">{description(target)}</span>
              </span>
            </label>
          );
        })}
      </div>

      {!availability.giftsConfigured ? (
        <div role="note" data-gifts-missing className="flex flex-col gap-1.5 rounded-lu-card border border-dashed border-lu-border-strong px-3 py-3">
          <p className="text-lu-sm font-medium text-lu-text">{copy.giftsMissing.title}</p>
          <p className="text-lu-xs text-lu-text-secondary">{copy.giftsMissing.description}</p>
          <Link href={routes.eventEdit(eventId)} className="self-start text-lu-sm font-medium text-lu-text underline underline-offset-2">
            {copy.giftsMissing.action}
          </Link>
        </div>
      ) : null}

      {includeBack ? (
        <div data-qr-preview={value} className="flex flex-col gap-1 rounded-lu-card bg-lu-surface-tint px-3 py-3">
          <p className="text-lu-xs font-medium uppercase tracking-wide text-lu-text-muted">{copy.previewTitle}</p>
          {value === "none" ? (
            <p className="text-lu-sm text-lu-text-secondary">{copy.noneNote}</p>
          ) : (
            <>
              <p className="font-lu-display text-lu-title-sm text-lu-text">{card[value].title}</p>
              <p className="text-lu-sm text-lu-text-secondary">{card[value].hint}</p>
              {opens ? (
                <p className="break-all text-lu-xs text-lu-text-muted">
                  {copy.opens}: {withoutScheme(opens)}
                </p>
              ) : null}
              <p className="text-lu-xs text-lu-text-muted">{value === "gift-link" ? copy.directValidity : qr.validUntil ? copy.validity(formatDate(qr.validUntil)) : copy.validityOpen}</p>
            </>
          )}
        </div>
      ) : null}

      <p role="status" aria-live="polite" className={cn("min-h-5 text-lu-xs", status?.tone === "error" ? "text-lu-text" : "text-lu-text-muted")}>
        {pending ? copy.saving : status?.message}
      </p>
    </fieldset>
  );
}
