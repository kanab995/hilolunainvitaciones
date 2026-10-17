import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { printCopy } from "@/lib/print/copy";

const copy = printCopy.page.product;

/**
 * El complemento «Archivo listo para imprimir» (D-47): precio aprobado ($199 MXN por evento), qué incluye y avisos honestos (color de
 * tinta, RGB, caducidad del QR). La compra está APAGADA: el botón no hace nada y lo dice («Muy pronto»). Nada aquí llama a Stripe.
 */
export function PrintProductCard({ price, currency, eligible, purchasable }: { price: number; currency: string; eligible: boolean; purchasable: boolean }) {
  return (
    <Card className="flex flex-col gap-5" data-print-product>
      <div className="flex flex-col gap-1">
        <h2 className="font-lu-display text-lu-title-sm text-lu-text">{copy.title}</h2>
        <p className="flex items-baseline gap-2">
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
      {eligible ? null : (
        <Badge tone="neutral" className="self-start">
          {copy.eligibility}
        </Badge>
      )}
      <div className="flex flex-col gap-2">
        <Button disabled={!purchasable} fullWidth {...(purchasable ? {} : { "aria-describedby": "print-product-status" })}>
          {purchasable ? copy.title : copy.comingSoon}
        </Button>
        {purchasable ? null : (
          <p id="print-product-status" className="text-center text-lu-sm text-lu-text-muted">
            {copy.comingSoonNote}
          </p>
        )}
      </div>
      <ul className="flex flex-col gap-2 border-t border-lu-border-subtle pt-4">
        {copy.notes.map((note) => (
          <li key={note} className="text-lu-xs text-lu-text-muted">
            {note}
          </li>
        ))}
      </ul>
    </Card>
  );
}
