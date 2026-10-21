import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AddonDuplicatesAlert, AddonPurchaseListTable } from "@/components/admin/addon-purchases";
import { BillingOverviewCard } from "@/components/billing/billing-overview";
import { PricingPrintAddon } from "@/components/billing/pricing-print-addon";
import { toAddonPurchaseLine } from "@/server/admin/addons";
import type { AddonHistoryRow } from "@/server/services/addon-service";
import type { BillingEventRow } from "@/server/services/billing-service";
import { visibleText } from "../invitation/helpers";

/**
 * ETAPA 4 del complemento (D-48) en la interfaz: `/pricing` lo presenta sin venderlo, «Compras y planes» lo muestra APARTE de las compras del
 * plan y la consola lo consulta en su propia lista, con los cobros duplicados señalados. Solo lectura en todas partes.
 */
const ROOT = process.cwd();
const source = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("/pricing: «También en papel, igual de especial»", () => {
  it("con la venta APAGADA: textos aprobados, precio con impuestos, solo PDF, Esencial y Premium, «Muy pronto» y ninguna compra", () => {
    const html = renderToStaticMarkup(<PricingPrintAddon saleOpen={false} />);
    const text = visibleText(html);
    expect(text).toContain("También en papel, igual de especial");
    expect(text).toContain("Convierte tu invitación digital en un diseño personalizado, listo para imprimir y entregar a tus invitados.");
    expect(text).toContain("$199 MXN");
    expect(text).toContain("Pago único por evento, con impuestos aplicables incluidos.");
    expect(text).toContain("Incluye el archivo digital en PDF. No incluye la impresión física ni el envío de tarjetas.");
    expect(text).toContain("Esencial y Premium");
    expect(text).toContain("Muy pronto");
    expect(html).not.toMatch(/<form|<button|href=/);
  });

  it("con la venta encendida tampoco se compra aquí: explica que se agrega desde el evento", () => {
    const html = renderToStaticMarkup(<PricingPrintAddon saleOpen />);
    expect(visibleText(html)).not.toContain("Muy pronto");
    expect(visibleText(html)).toContain("«Versión para imprimir»");
    expect(html).not.toMatch(/<form|<button|href=/);
  });

  it("la página la incluye y decide «Muy pronto» con el mismo interruptor que la venta", () => {
    const page = source("app/(site)/(marketing)/pricing/page.tsx");
    expect(page).toMatch(/<PricingPrintAddon saleOpen=\{isPrintAddonSaleOpen\(\)\} \/>/);
  });
});

const event: BillingEventRow = {
  eventId: "evt_A",
  slug: "andrea-y-fernando",
  title: "Andrea & Fernando",
  startsAt: new Date("2027-05-17T23:00:00Z"),
  plan: "ESSENTIAL",
  accessState: "active",
  paidAccessEndsAt: new Date("2027-06-16T23:00:00Z"),
  guests: { count: 10, max: 100 },
  gallery: { count: 2, max: 15 },
  purchases: [{ id: "pur_1", plan: "ESSENTIAL", kind: "INITIAL", status: "PAID", amount: 49900, currency: "MXN", paidAt: new Date("2027-01-02T18:00:00Z") }],
  canUpgrade: true,
};

const addon = (over: Partial<AddonHistoryRow>): AddonHistoryRow => ({
  id: "add_1",
  eventId: "evt_A",
  addon: "PRINT_FILE",
  product: "Archivo listo para imprimir",
  amount: 19900,
  currency: "MXN",
  status: "PAID",
  paidAt: new Date("2027-03-01T18:00:00Z"),
  refundedAt: null,
  duplicate: false,
  ...over,
});

describe("Compras y planes: historial de complementos, aparte del plan", () => {
  it("producto, precio pagado, fecha, estado, acceso a la descarga y reembolso; las compras del plan no cambian", () => {
    const addons = [
      addon({}),
      addon({ id: "add_2", status: "REFUNDED", refundedAt: new Date("2027-03-05T18:00:00Z") }),
      addon({ id: "add_3", duplicate: true }),
      addon({ id: "add_other", eventId: "evt_B" }),
    ];
    const html = renderToStaticMarkup(<BillingOverviewCard overview={{ events: [event], payments: "ready" }} addons={addons} />);
    const section = html.slice(html.indexOf("data-billing-addons"));
    const text = visibleText(section);
    expect(text).toContain("Complementos");
    expect(text).toContain("Archivo listo para imprimir · $199 MXN");
    expect(text).toContain("Comprado el 1 de marzo de 2027");
    expect(text).toContain("Reembolsado el 5 de marzo de 2027");
    expect(text).toContain("Este pago se reembolsó y ya no da acceso a la descarga.");
    expect(text).toContain("Cobro duplicado · lo revisaremos para reembolsarlo");
    expect(section.match(/href="\/dashboard\/events\/evt_A\/print"/g)).toHaveLength(1);
    // Solo los complementos de ESTE evento.
    expect(html.match(/data-addon-purchase=/g)).toHaveLength(3);
    // El historial de pagos del plan sigue siendo solo el del plan.
    expect(html.slice(0, html.indexOf("data-billing-addons")).match(/data-purchase-status=/g)).toHaveLength(1);
  });

  it("sin complementos no aparece la sección", () => {
    expect(renderToStaticMarkup(<BillingOverviewCard overview={{ events: [event], payments: "ready" }} />)).not.toContain("data-billing-addons");
  });

  it("la página lee los complementos aparte del resumen de planes", () => {
    expect(source("app/(site)/dashboard/(workspace)/billing/page.tsx")).toMatch(/Promise\.all\(\[getBillingOverview\(user\), getAddonHistory\(user\)\]\)/);
  });
});

describe("consola: compras de complementos (solo lectura)", () => {
  const line = { id: "add_1", addon: "PRINT_FILE" as const, status: "PAID" as const, amount: 19900, currency: "MXN", provider: "STRIPE" as const, createdAt: new Date("2027-03-01T18:00:00Z"), paidAt: new Date("2027-03-01T18:00:00Z"), refundedAt: null };

  it("un cobro PAGADO sin desbloqueo es un duplicado; el DTO nunca lleva la clave de desbloqueo", () => {
    expect(toAddonPurchaseLine({ ...line, unlocks: true })).toMatchObject({ duplicate: false, unlocks: true, amountMinor: 19900 });
    expect(toAddonPurchaseLine({ ...line, unlocks: false })).toMatchObject({ duplicate: true });
    expect(toAddonPurchaseLine({ ...line, status: "REFUNDED", unlocks: false })).toMatchObject({ duplicate: false });
    expect(Object.keys(toAddonPurchaseLine({ ...line, unlocks: true }))).not.toContain("unlockKey");
  });

  it("la lista señala el duplicado con texto y enlaza al evento, al usuario y al detalle", () => {
    const row = { ...toAddonPurchaseLine({ ...line, unlocks: false }), event: { id: "evt_A", title: "Andrea & Fernando" }, user: { id: "usr_A", name: "Andrea", email: "a@example.com" } };
    const html = renderToStaticMarkup(<AddonPurchaseListTable rows={[row]} />);
    expect(visibleText(html)).toContain("Cobro duplicado");
    expect(html).toContain('href="/admin/purchases/addons/add_1"');
    expect(html).toContain('href="/admin/users/usr_A"');
    expect(html).not.toMatch(/<form|<button/);
  });

  it("el aviso de duplicados solo aparece si hay alguno y lleva al filtro", () => {
    expect(renderToStaticMarkup(<AddonDuplicatesAlert count={0} />)).toBe("");
    const html = renderToStaticMarkup(<AddonDuplicatesAlert count={2} />);
    expect(visibleText(html)).toContain("Hay 2 cobros duplicados de complementos pendientes de reembolso.");
    expect(html).toContain('href="/admin/purchases/addons?flag=duplicate"');
  });

  it("las páginas nuevas exigen requireAdmin y no tienen acciones (ni formularios de escritura ni Server Actions)", () => {
    for (const page of ["app/(site)/admin/purchases/addons/page.tsx", "app/(site)/admin/purchases/addons/[id]/page.tsx"]) {
      const code = source(page);
      expect(code, page).toMatch(/await requireAdmin\(\)/);
      expect(code, page).not.toMatch(/"use server"|action=|<form/);
    }
    expect(source("server/admin/addons.ts")).not.toMatch(/\.(create|update|upsert|delete)(Many)?\(/);
    expect(source("server/repositories/admin.ts")).not.toMatch(/eventAddonPurchase\.(create|update|upsert|delete)/);
  });
});
