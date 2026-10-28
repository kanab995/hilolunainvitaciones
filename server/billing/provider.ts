import type { AddonId } from "@/lib/billing/addons";
import type { PaidPlanId } from "@/lib/billing/plans";
import type { BillingProviderId } from "@/lib/billing/purchase";

/**
 * ABSTRACCIÓN DEL PROVEEDOR DE COBRO (D-32: pago único por evento). El dominio y los servicios dependen SOLO de esta interfaz:
 * nadie fuera de `server/billing/<proveedor>/` importa el SDK del proveedor ni conoce sus estados o formas. Añadir otro proveedor
 * (p. ej. Mercado Pago) es escribir otro adaptador que la cumpla, sin tocar servicios, componentes ni derechos.
 */

/**
 * Pago de una sesión de cobro, en términos neutrales (el adaptador ya tradujo estados y campos del proveedor). El servicio NO
 * confía en la metadata: verifica el precio (referencias), el importe y la moneda contra su propia configuración.
 */
export interface ProviderPayment {
  checkoutSessionId: string;
  paymentIntentId: string | null;
  providerCustomerId: string | null;
  /**
   * `PAID` = cobrado (o completado sin cobro porque un código de descuento dejó el total en 0); `PENDING` = abierto o sin cobrar todavía;
   * `EXPIRED` = la sesión caducó sin pago.
   */
  status: "PAID" | "PENDING" | "EXPIRED";
  /** Importe cobrado en unidades menores (centavos), ya con el descuento aplicado. */
  amountMinor: number;
  /** Importe ANTES de descuentos (precio de las líneas). Sin él se asume `amountMinor` (sesión sin descuentos). */
  subtotalMinor?: number;
  /** Descuento aplicado por un código promocional del proveedor. Sin él se asume 0. */
  discountMinor?: number;
  /** ISO 4217 en mayúsculas (`MXN`). */
  currency: string;
  /** Referencias de precio del proveedor de las líneas cobradas (p. ej. `price_…`). */
  priceRefs: string[];
  /** Metadata que Hilo Luna adjuntó al crear la sesión (solo orientativa; se verifica). `addon` solo en las compras de complementos (D-48). */
  metadata: { userId?: string; eventId?: string; targetPlan?: string; addon?: string };
}

/**
 * Evento de webhook ya VERIFICADO y normalizado. Un evento es solo el DISPARADOR: el servicio vuelve a consultar el estado real del
 * pago al proveedor antes de conceder nada. Los tipos que no se usan (p. ej. los de la antigua suscripción mensual) → `ignore`.
 */
export type NormalizedWebhookEvent = { id: string; type: string; createdAt: Date } & (
  | { action: "confirm_payment"; checkoutSessionId?: string; paymentIntentId?: string }
  | { action: "close_payment"; outcome: "FAILED" | "CANCELED"; checkoutSessionId?: string; paymentIntentId?: string; metadata?: { eventId?: string; targetPlan?: string; addon?: string } }
  | { action: "refund_payment"; paymentIntentId: string }
  | { action: "ignore" }
);

/**
 * ¿El cobro corresponde EXACTAMENTE al precio esperado? Admite códigos de descuento del proveedor (creados por el propietario en su
 * panel), pero solo si las cuentas cuadran: el precio de lista (subtotal) es el esperado, el descuento no es negativo ni mayor que el
 * precio, y lo cobrado es precio − descuento. Un importe distinto sin descuento que lo explique se sigue rechazando.
 */
export function chargeMatchesPrice(payment: Pick<ProviderPayment, "amountMinor" | "subtotalMinor" | "discountMinor">, expectedMinor: number): boolean {
  const subtotal = payment.subtotalMinor ?? payment.amountMinor;
  const discount = payment.discountMinor ?? 0;
  return subtotal === expectedMinor && discount >= 0 && discount <= expectedMinor && payment.amountMinor === expectedMinor - discount;
}

/** La firma del webhook no es válida (o falta): el cuerpo no se procesa. */
export class WebhookSignatureError extends Error {
  constructor() {
    super("Firma de webhook inválida.");
    this.name = "WebhookSignatureError";
  }
}

export interface BillingProvider {
  readonly id: BillingProviderId;

  /** Precio del proveedor para una variable de precio de la configuración (`STRIPE_PRICE_…`), o `undefined` si no está configurado. Lo resuelve SIEMPRE el servidor. */
  priceRefFor(priceKey: string): string | undefined;
  /** Variable de precio de la configuración a la que corresponde un precio del proveedor, o `undefined` si es desconocido (nunca concede un plan). */
  priceKeyFor(priceRef: string): string | undefined;

  /**
   * ¿El precio configurado existe en el proveedor y es lo que se pretende cobrar? Comprueba que esté activo, sea de PAGO ÚNICO (no recurrente) y
   * tenga exactamente el importe y la moneda esperados. Se llama ANTES de abrir el cobro: un precio mal configurado (p. ej. el de 799 en la
   * variable de 499) haría que el cliente pagara y el webhook rechazara el cobro (plan sin activar). `false` = el checkout debe fallar de forma
   * segura sin cobrar nada. Lanza si el proveedor no responde (fallo transitorio, no un desajuste).
   */
  verifyPrice(priceKey: string, expected: { amountMinor: number; currency: string }): Promise<boolean>;

  createCustomer(input: { userId: string; email: string; name: string | null }): Promise<{ providerCustomerId: string }>;
  /**
   * Sesión de pago ÚNICO para UN evento. `priceKey` identifica el precio (compra inicial o mejora). `idempotencyKey` es estable por
   * intento (usuario + evento + plan + tipo + ventana de tiempo + nº de compras del evento): dos peticiones simultáneas con la misma
   * clave reciben la MISMA sesión (una sola sesión efectiva). `expiresAt` acota la vida de la sesión (una sesión abandonada caduca
   * pronto y ya no puede cobrarse por error).
   */
  createEventCheckout(input: { providerCustomerId: string; priceKey: string; plan: PaidPlanId; eventId: string; userId: string; successUrl: string; cancelUrl: string; idempotencyKey: string; expiresAt: Date }): Promise<{ url: string; checkoutSessionId: string }>;
  /**
   * Sesión de pago ÚNICO de un COMPLEMENTO de UN evento (D-48). Igual que la de un plan, pero su metadata lleva `addon` y NUNCA `targetPlan`:
   * un complemento no puede confundirse con un plan (el webhook lo distingue por el PRECIO cobrado, no por la metadata).
   */
  createAddonCheckout(input: { providerCustomerId: string; priceKey: string; addon: AddonId; eventId: string; userId: string; successUrl: string; cancelUrl: string; idempotencyKey: string; expiresAt: Date }): Promise<{ url: string; checkoutSessionId: string }>;
  /** Estado de una sesión de cobro ya creada (para reutilizar una abierta en vez de abrir otra). `undefined` si no existe. */
  getCheckoutSession(checkoutSessionId: string): Promise<{ status: "open" | "complete" | "expired"; url: string | null } | undefined>;
  /** Caduca una sesión abierta (best-effort: si ya se completó, el proveedor la rechaza y el llamador lo ignora). */
  expireCheckoutSession(checkoutSessionId: string): Promise<void>;
  /** Estado real de un pago a partir de su sesión de cobro. */
  getPayment(checkoutSessionId: string): Promise<ProviderPayment | undefined>;
  /** Idem, a partir del identificador del pago (`payment_intent`). */
  findPaymentByIntent(paymentIntentId: string): Promise<ProviderPayment | undefined>;
  /** Portal del cliente del proveedor (recibos y datos de pago). No gestiona el plan de ningún evento. */
  createPortalSession(input: { providerCustomerId: string; returnUrl: string }): Promise<{ url: string }>;

  /** Verifica la firma y normaliza el evento. Lanza `WebhookSignatureError` si la firma no es válida. */
  parseWebhook(rawBody: string, signature: string | null): NormalizedWebhookEvent;
}

/** Estado de la configuración de pagos de este entorno. */
export type BillingProviderState =
  | { status: "ready"; provider: BillingProvider }
  /** Falta configuración: la app funciona como Gratis y el checkout muestra «no configurado». */
  | { status: "not_configured" }
  /** Hay configuración pero es inconsistente (p. ej. claves de modos distintos). `problems` nombra variables, nunca valores. */
  | { status: "invalid"; problems: string[] };
