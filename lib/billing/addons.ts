import { PRICING_CURRENCY, type PaidPlanId, type PlanId } from "@/lib/billing/plans";

/**
 * COMPLEMENTOS POR EVENTO (D-47). Un complemento NO es un plan: se compra aparte, nunca cambia el plan del evento y nunca concede
 * capacidades de un plan. Precio aprobado por el propietario: $199 MXN por evento, solo para eventos Esencial y Premium.
 *
 * **La compra está APAGADA** (`purchasable: false`): no hay precio de Stripe, ni checkout, ni webhook para complementos todavía
 * (Etapa 3, pendiente de la prueba de color en imprenta y de la aprobación del propietario). Mientras tanto la vista previa es libre y
 * el PDF limpio solo lo descarga una cuenta ADMIN, de SUS propios eventos, como prueba interna.
 */
export const ADDON_IDS = ["PRINT_FILE"] as const;
export type AddonId = (typeof ADDON_IDS)[number];

export interface AddonConfig {
  id: AddonId;
  name: string;
  /** Precio en pesos, impuestos incluidos (decisión del propietario; la revisión fiscal sigue pendiente antes de cobrar). */
  displayPrice: number;
  currency: typeof PRICING_CURRENCY;
  /** Planes del evento que pueden comprarlo. */
  eligiblePlans: readonly PaidPlanId[];
  /** ¿Se puede comprar ya? `false` hasta la Etapa 3. */
  purchasable: boolean;
}

export const ADDONS: Readonly<Record<AddonId, AddonConfig>> = {
  PRINT_FILE: { id: "PRINT_FILE", name: "Archivo listo para imprimir", displayPrice: 199, currency: PRICING_CURRENCY, eligiblePlans: ["ESSENTIAL", "PREMIUM"], purchasable: false },
};

export const isAddonEligiblePlan = (addon: AddonId, plan: PlanId): boolean => (ADDONS[addon].eligiblePlans as readonly PlanId[]).includes(plan);

/**
 * ¿Puede este usuario descargar el PDF limpio de este evento (que ya se comprobó que es SUYO)? Con la compra apagada nadie lo ha
 * comprado (`purchased` siempre es `false` en esta etapa): solo la prueba interna de administración.
 */
export function canDownloadPrintFile(input: { purchased: boolean; isAdmin: boolean }): boolean {
  return input.purchased || input.isAdmin;
}

/** «$199 MXN». */
export const formatAddonPrice = (addon: AddonId): string => `$${ADDONS[addon].displayPrice} ${ADDONS[addon].currency}`;
