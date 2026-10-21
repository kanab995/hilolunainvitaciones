import { PRICING_CURRENCY, type PaidPlanId, type PlanId } from "@/lib/billing/plans";
import { toMinorUnits, type PurchaseStatusId } from "@/lib/billing/purchase";

/**
 * COMPLEMENTOS POR EVENTO (D-47 / D-48). Un complemento NO es un plan: se compra aparte, se guarda en su propia tabla
 * (`EventAddonPurchase`), nunca cambia el plan del evento y nunca concede capacidades de un plan. Precio aprobado por el propietario:
 * **$199 MXN por evento, impuestos aplicables incluidos**, solo para eventos Esencial y Premium. Módulo puro (sin proveedor ni base de datos).
 *
 * Venta APAGADA por defecto: para venderse hacen falta las DOS cosas — el interruptor `PRINT_ADDON_ENABLED=1` (que el propietario activa
 * solo cuando lo autoriza) y el precio de Stripe (`STRIPE_PRICE_ADDON_PRINT_FILE`, pago único de 199 MXN). Sin ellas la vista previa sigue
 * libre y nadie puede pagar.
 */
export const ADDON_IDS = ["PRINT_FILE"] as const;
export type AddonId = (typeof ADDON_IDS)[number];

export interface AddonConfig {
  id: AddonId;
  name: string;
  /** Precio en pesos, impuestos aplicables incluidos (no se suma nada al cobrar). */
  displayPrice: number;
  currency: typeof PRICING_CURRENCY;
  /** Planes del evento que pueden comprarlo. */
  eligiblePlans: readonly PaidPlanId[];
  /** Variable de entorno con el `price_…` de Stripe (pago único). */
  stripePriceEnvKey: string;
  /** Variable de entorno que enciende la venta (`1`). */
  enableEnvKey: string;
}

export const ADDONS: Readonly<Record<AddonId, AddonConfig>> = {
  PRINT_FILE: {
    id: "PRINT_FILE",
    name: "Archivo listo para imprimir",
    displayPrice: 199,
    currency: PRICING_CURRENCY,
    eligiblePlans: ["ESSENTIAL", "PREMIUM"],
    stripePriceEnvKey: "STRIPE_PRICE_ADDON_PRINT_FILE",
    enableEnvKey: "PRINT_ADDON_ENABLED",
  },
};

export const isAddonId = (value: unknown): value is AddonId => typeof value === "string" && (ADDON_IDS as readonly string[]).includes(value);

/** Variables de precio de los complementos (para leer y validar el entorno junto a las de los planes). */
export const ADDON_PRICE_ENV_KEYS: readonly string[] = ADDON_IDS.map((id) => ADDONS[id].stripePriceEnvKey);

/** ¿Qué complemento representa una variable de precio? (`undefined` = no es de un complemento). */
export const addonForPriceKey = (envKey: string): AddonId | undefined => ADDON_IDS.find((id) => ADDONS[id].stripePriceEnvKey === envKey);

/** Importe esperado de un complemento, en unidades menores (19 900 centavos). Es lo que el webhook exige que coincida con lo cobrado. */
export const expectedAddonAmountMinor = (addon: AddonId): number => toMinorUnits(ADDONS[addon].displayPrice);

export const isAddonEligiblePlan = (addon: AddonId, plan: PlanId): boolean => (ADDONS[addon].eligiblePlans as readonly PlanId[]).includes(plan);

/** ¿Está encendida la venta de este complemento en el entorno? (`1`, `true` o `yes`). */
export const isAddonSaleEnabled = (addon: AddonId, env: Readonly<Record<string, string | undefined>>): boolean => ["1", "true", "yes"].includes((env[ADDONS[addon].enableEnvKey] ?? "").trim().toLowerCase());

/** Lo mínimo de una compra de complemento que necesita la política. */
export interface AddonPurchaseSnapshot {
  addon: AddonId;
  status: PurchaseStatusId;
}

/** ¿El evento tiene este complemento PAGADO? (Pendiente, fallido, cancelado o reembolsado no cuentan: un reembolso retira la descarga.) */
export const hasPaidAddon = (purchases: readonly AddonPurchaseSnapshot[], addon: AddonId): boolean => purchases.some((purchase) => purchase.addon === addon && purchase.status === "PAID");

/**
 * Presupuesto de la compra de un complemento para un evento con plan `plan`. Solo Esencial y Premium; un evento que ya lo tiene PAGADO
 * no puede volver a comprarlo (las descargas son ilimitadas).
 */
export type AddonQuote = { ok: true; addon: AddonId; amount: number; amountMinor: number; currency: string; priceEnvKey: string } | { ok: false; reason: "ineligible_plan" | "already_purchased" };

export function quoteAddonPurchase(addon: AddonId, plan: PlanId, purchases: readonly AddonPurchaseSnapshot[]): AddonQuote {
  if (!isAddonEligiblePlan(addon, plan)) return { ok: false, reason: "ineligible_plan" };
  if (hasPaidAddon(purchases, addon)) return { ok: false, reason: "already_purchased" };
  const config = ADDONS[addon];
  return { ok: true, addon, amount: config.displayPrice, amountMinor: expectedAddonAmountMinor(addon), currency: config.currency, priceEnvKey: config.stripePriceEnvKey };
}

/**
 * ¿Puede este usuario descargar el PDF limpio de este evento (que ya se comprobó que es SUYO)? Con el complemento PAGADO, sí, todas las
 * veces que quiera; además, la prueba interna de una cuenta ADMIN de sus propios eventos.
 */
export function canDownloadPrintFile(input: { purchased: boolean; isAdmin: boolean }): boolean {
  return input.purchased || input.isAdmin;
}

/** «$199 MXN». */
export const formatAddonPrice = (addon: AddonId): string => `$${ADDONS[addon].displayPrice} ${ADDONS[addon].currency}`;
