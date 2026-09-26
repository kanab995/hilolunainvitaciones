/**
 * FORMATO de la consola (fechas e importes). En la zona por defecto del producto: el resultado no depende de la del servidor.
 */
const ZONE = "America/Mexico_City";

const dateFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: ZONE });
const dateTimeFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: ZONE });

export const formatAdminDate = (date: Date | null | undefined): string => (date ? dateFormat.format(date) : "—");
export const formatAdminDateTime = (date: Date | null | undefined): string => (date ? dateTimeFormat.format(date) : "—");

/** Importe en unidades menores (centavos) SIN moneda: `49900` → «$499». Con centavos distintos de cero muestra los dos decimales. */
export function formatMinorNumber(amountMinor: number): string {
  const whole = amountMinor % 100 === 0;
  const number = new Intl.NumberFormat("es-MX", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(amountMinor / 100);
  return `$${number}`;
}

/** Importe con su moneda: `49900, "MXN"` → «$499 MXN». Sin conversión de divisas: cada moneda se muestra en la suya. */
export const formatMinorAmount = (amountMinor: number, currency: string): string => `${formatMinorNumber(amountMinor)} ${currency}`;
