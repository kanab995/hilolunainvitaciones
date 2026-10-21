import { Check } from "lucide-react";
import Link from "next/link";
import { AddonCheckoutForm } from "@/components/print/addon-checkout-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { printCopy } from "@/lib/print/copy";
import { routes } from "@/lib/routes";

const copy = printCopy.page.product;

/** Estado de la compra del complemento que necesita la tarjeta (lo calcula `getPrintAddonState`). */
export interface ProductCardAddon {
  eligible: boolean;
  saleOpen: boolean;
  purchased: boolean;
  paidAt: Date | null;
  pendingPayment: boolean;
  qrValidUntil: Date | null;
}

const longDate = (date: Date) => new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "America/Mexico_City" }).format(date);

/**
 * El complemento «Archivo listo para imprimir» (D-47 / D-48): precio aprobado ($199 MXN por evento, impuestos incluidos), qué incluye, avisos
 * honestos (color de tinta y RGB, vigencia del QR) y la acción que corresponde al estado del evento:
 *  - ya comprado → «Comprado» (la descarga está en las opciones);
 *  - pago en confirmación → aviso, sin botón (no se puede pagar dos veces);
 *  - plan Gratis → «Mejorar evento» (el complemento es para Esencial y Premium);
 *  - venta abierta → «Comprar · $199 MXN» (Stripe);
 *  - venta apagada (interruptor, Stripe o precio sin configurar) → «Muy pronto», sin acción.
 */
export function PrintProductCard({ eventId, price, currency, addon }: { eventId: string; price: number; currency: string; addon: ProductCardAddon }) {
  const priceLabel = `$${price} ${currency}`;
  return (
    <Card className="flex flex-col gap-5" data-print-product data-addon-state={addon.purchased ? "purchased" : addon.pendingPayment ? "pending" : !addon.eligible ? "ineligible" : addon.saleOpen ? "available" : "unavailable"}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-lu-display text-lu-title-sm text-lu-text">{copy.title}</h2>
          {addon.purchased ? (
            <Badge tone="success" className="shrink-0">
              {copy.purchased}
            </Badge>
          ) : null}
        </div>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-lu-display text-lu-title-lg text-lu-text">
            ${price} <span className="text-lu-sm">{currency}</span>
          </span>
          <span className="text-lu-sm text-lu-text-muted">{copy.priceNote}</span>
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {copy.features.map((feature) => (
          <li key={feature} className="flex gap-2 text-lu-sm text-lu-text-secondary">
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-lu-brown-600" />
            {feature}
          </li>
        ))}
      </ul>

      {addon.purchased ? (
        <p className="text-lu-sm text-lu-text-secondary">{copy.purchasedOn(addon.paidAt ? longDate(addon.paidAt) : "")}</p>
      ) : addon.pendingPayment ? (
        <div role="status" className="flex flex-col gap-1 rounded-lu-card bg-lu-surface-tint px-4 py-3">
          <p className="font-medium text-lu-sm text-lu-text">{copy.pending}</p>
          <p className="text-lu-sm text-lu-text-secondary">{copy.pendingNote}</p>
        </div>
      ) : !addon.eligible ? (
        <div className="flex flex-col gap-3">
          <Badge tone="neutral" className="self-start">
            {copy.eligibility}
          </Badge>
          <p className="text-lu-sm text-lu-text-secondary">{copy.upgradeNote}</p>
          <Button asChild variant="secondary" fullWidth>
            <Link href={routes.eventUpgrade(eventId)}>{copy.upgradeFirst}</Link>
          </Button>
        </div>
      ) : addon.saleOpen ? (
        <div className="flex flex-col gap-1">
          <AddonCheckoutForm eventId={eventId} label={copy.buy(priceLabel)} />
          <p className="text-lu-xs text-lu-text-muted">{copy.buyNote}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button disabled fullWidth aria-describedby="print-product-status">
            {copy.comingSoon}
          </Button>
          <p id="print-product-status" className="text-center text-lu-sm text-lu-text-muted">
            {copy.comingSoonNote}
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-2 border-t border-lu-border-subtle pt-4">
        {/* La vigencia del QR, con la fecha real del evento cuando se conoce (acceso de pago = evento + 30 días). */}
        <li className="text-lu-xs text-lu-text-muted">{addon.qrValidUntil ? copy.qrValidUntil(longDate(addon.qrValidUntil)) : copy.notes[1]}</li>
        <li className="text-lu-xs text-lu-text-muted">{copy.notes[0]}</li>
      </ul>
    </Card>
  );
}
