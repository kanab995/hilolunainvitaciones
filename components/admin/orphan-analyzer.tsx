"use client";

import { useActionState } from "react";
import { analyzeOrphansAction, type OrphanAnalysisState } from "@/app/(site)/admin/actions";
import { Button } from "@/components/ui/button";
import { adminCopy } from "@/lib/admin/copy";

const copy = adminCopy.overview.orphans;
const initial: OrphanAnalysisState = { status: "idle" };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toLocaleString("es-MX", { maximumFractionDigits: 1 })} ${units[unit]}`;
}

/**
 * «Analizar» huérfanos (solo lectura): la consola NO tiene botón de borrado. Muestra cantidad y tamaño estimado; la limpieza es manual
 * (`npm run media:orphans`, con análisis previo y confirmación fuerte).
 */
export function OrphanAnalyzer() {
  const [state, action, pending] = useActionState(analyzeOrphansAction, initial);
  const { report } = state;
  return (
    <form action={action} className="flex flex-col gap-3 border-t border-lu-border-subtle pt-4">
      <Button type="submit" variant="secondary" size="sm" loading={pending} className="self-start">
        {pending ? copy.analyzing : copy.analyze}
      </Button>
      <div role="status" aria-live="polite" className="text-lu-sm text-lu-text-secondary">
        {state.status === "error" ? <p className="text-lu-error">{state.message}</p> : null}
        {report ? (
          <ul data-orphan-report className="flex flex-col gap-1">
            <li>{copy.result(report.count, formatBytes(report.bytes))}</li>
            <li>{copy.pending(report.stalePending, report.pendingGraceHours)}</li>
            <li>{copy.unreferenced(report.unreferencedReady, report.readyGraceHours)}</li>
            {report.truncated ? <li>{copy.truncated(report.batchLimit)}</li> : null}
            <li className="text-lu-text-muted">{copy.manualCleanup}</li>
          </ul>
        ) : null}
      </div>
    </form>
  );
}
