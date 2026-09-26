import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * TABLA de la consola: `<table>` semántica (título, cabeceras con `scope="col"`) a partir del punto de corte `cards` y, por debajo, una lista de
 * tarjetas con el mismo contenido (etiqueta → valor). Solo UNA de las dos es visible a la vez (`hidden`), así que un lector de pantalla no lee
 * el contenido dos veces y nunca hay desbordamiento horizontal de la página. Las columnas se definen una sola vez.
 */
export interface AdminColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Columna que actúa como título de la tarjeta (sin etiqueta). */
  primary?: boolean;
  align?: "end";
  /** Clases extra de la celda de la tabla (p. ej. ancho). */
  className?: string;
}

const tableVisible = { md: "hidden md:block", lg: "hidden lg:block", xl: "hidden xl:block" } as const;
const cardsVisible = { md: "md:hidden", lg: "lg:hidden", xl: "xl:hidden" } as const;

export function AdminTable<T>({ caption, columns, rows, rowKey, cards = "lg", empty }: { caption: string; columns: readonly AdminColumn<T>[]; rows: readonly T[]; rowKey: (row: T) => string; cards?: keyof typeof tableVisible; empty: string }) {
  if (rows.length === 0) {
    return (
      <p role="status" className="rounded-lu-card border border-dashed border-lu-border-strong bg-lu-surface-muted/60 px-6 py-10 text-center text-lu-base text-lu-text-secondary">
        {empty}
      </p>
    );
  }
  const primary = columns.find((column) => column.primary) ?? columns[0];
  return (
    <>
      <div className={cn("rounded-lu-card border border-lu-border-subtle bg-lu-surface", tableVisible[cards])}>
        <table className="w-full border-collapse text-left text-lu-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-lu-border-subtle text-lu-text-muted">
              {columns.map((column) => (
                <th key={column.id} scope="col" className={cn("px-3 py-2.5 font-medium whitespace-nowrap", column.align === "end" && "text-right")}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-lu-border-subtle">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="align-middle">
                {columns.map((column) => (
                  <td key={column.id} className={cn("max-w-[18rem] min-w-0 px-3 py-2.5 text-lu-text", column.align === "end" && "text-right tabular-nums", column.className)}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul aria-label={caption} className={cn("flex flex-col gap-3", cardsVisible[cards])}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="flex min-w-0 flex-col gap-3 rounded-lu-card border border-lu-border-subtle bg-lu-surface p-4">
            {primary ? <div className="min-w-0 text-lu-base font-medium text-lu-text">{primary.cell(row)}</div> : null}
            <dl className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-x-3 gap-y-2 text-lu-sm">
              {columns
                .filter((column) => column !== primary)
                .map((column) => (
                  <div key={column.id} className="col-span-2 grid grid-cols-subgrid items-baseline">
                    <dt className="text-lu-text-muted">{column.header}</dt>
                    <dd className="min-w-0 break-words text-lu-text">{column.cell(row)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
