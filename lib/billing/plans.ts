/**
 * CONFIGURACIÓN CENTRAL DE PLANES (D-32: un pago único POR EVENTO). Los planes son PRODUCTO, no contenido de usuario: viven en
 * código, versionados, y cambiar un precio o una cuota es editar un número aquí, sin tocar la lógica ni la interfaz. Nada del
 * resto del proyecto escribe «499» o «799»: todo sale de esta configuración.
 *
 * Un plan pertenece a un EVENTO (no a la cuenta): una misma persona puede tener un evento Gratis, otro Esencial y otro Premium.
 * Se distinguen dos cosas que no deben mezclarse:
 *  - FEATURE (booleana): «¿puede usar X?» — `features`.
 *  - CUOTA (numérica): «¿cuánto de X en este evento?» — `limits`. `null` = sin límite (nunca `0` ni `Infinity`).
 *
 * Este módulo es puro: no conoce a Stripe (ni a ningún proveedor), a Prisma ni a React. Los importes son la configuración INICIAL
 * de producto (no un contrato legal) y el webhook verifica el importe cobrado contra ellos.
 */
export const PLAN_IDS = ["FREE", "ESSENTIAL", "PREMIUM"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** Planes que se compran (requieren un pago). */
export const PAID_PLAN_IDS = ["ESSENTIAL", "PREMIUM"] as const;
export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];

/** Capacidades de sí/no. Cada una debe estar respaldada por una función real del producto. */
export const FEATURE_IDS = ["publish", "personalizedGuestLinks", "qr", "calendar", "customMedia"] as const;
export type FeatureId = (typeof FEATURE_IDS)[number];

/**
 * Cuotas numéricas POR EVENTO. `null` = sin límite. No existe un límite de eventos por plan (cada evento se compra por separado).
 * `maxPublicRsvpResponses` (D-40) es DISTINTA de `maxGuestsPerEvent`: la primera cuenta solo invitados que el anfitrión agregó a
 * mano (Guest Manager); la segunda, respuestas auto-registradas por el enlace general público (`/i/<slug>`, sin `?guest=`). Nunca
 * se mezclan: un enlace general que se vuelve viral no puede agotar el cupo de invitados que el anfitrión pagó para gestionar.
 */
export const LIMIT_IDS = ["maxGuestsPerEvent", "maxGalleryImages", "maxPublicRsvpResponses"] as const;
export type LimitId = (typeof LIMIT_IDS)[number];

/** Moneda de todos los precios. Un precio del proveedor en otra moneda se rechaza (no hay conversión de divisas). */
export const PRICING_CURRENCY = "MXN";

export interface PlanPricing {
  /** Precio mostrado y esperado, en unidades enteras de la moneda (pesos). El webhook exige que el cobro coincida. */
  displayPrice: number;
  currency: typeof PRICING_CURRENCY;
  /** Nombre de la variable de entorno con el precio de pago único del proveedor (`null` en el plan gratuito). */
  stripePriceEnvKey: string | null;
  /**
   * Mejora desde otro plan (solo se cobra la DIFERENCIA): `desde plan → variable de entorno del precio de la mejora`. El importe
   * es `displayPrice(este) − displayPrice(desde)` (ver `quoteEventPurchase`): nunca se escribe a mano.
   */
  upgradeFrom: Readonly<Partial<Record<PlanId, { stripePriceEnvKey: string }>>>;
}

export interface PlanConfig {
  id: PlanId;
  /** Nombre visible. */
  name: string;
  description: string;
  /** Orden de menor a mayor: define «este plan incluye a aquel» (plantillas con plan mínimo, mejoras). */
  rank: number;
  features: Readonly<Record<FeatureId, boolean>>;
  limits: Readonly<Record<LimitId, number | null>>;
  pricing: PlanPricing;
}

const ALL_ON: Readonly<Record<FeatureId, boolean>> = { publish: true, personalizedGuestLinks: true, qr: true, calendar: true, customMedia: true };

export const planConfigs: Readonly<Record<PlanId, PlanConfig>> = {
  FREE: {
    id: "FREE",
    name: "Gratis",
    description: "Para conocer Hilo Luna y crear una invitación sencilla.",
    rank: 0,
    features: ALL_ON,
    limits: { maxGuestsPerEvent: 30, maxGalleryImages: 5, maxPublicRsvpResponses: 50 },
    pricing: { displayPrice: 0, currency: "MXN", stripePriceEnvKey: null, upgradeFrom: {} },
  },
  ESSENTIAL: {
    id: "ESSENTIAL",
    name: "Esencial",
    description: "Todo lo necesario para compartir una invitación elegante y funcional.",
    rank: 1,
    features: ALL_ON,
    limits: { maxGuestsPerEvent: 100, maxGalleryImages: 15, maxPublicRsvpResponses: 150 },
    pricing: { displayPrice: 499, currency: "MXN", stripePriceEnvKey: "STRIPE_PRICE_ESSENTIAL_ONE_TIME", upgradeFrom: {} },
  },
  PREMIUM: {
    id: "PREMIUM",
    name: "Premium",
    description: "Más capacidad y una experiencia más completa para celebraciones importantes.",
    rank: 2,
    features: ALL_ON,
    limits: { maxGuestsPerEvent: 300, maxGalleryImages: 40, maxPublicRsvpResponses: 250 },
    pricing: { displayPrice: 799, currency: "MXN", stripePriceEnvKey: "STRIPE_PRICE_PREMIUM_ONE_TIME", upgradeFrom: { ESSENTIAL: { stripePriceEnvKey: "STRIPE_PRICE_ESSENTIAL_TO_PREMIUM" } } },
  },
};

export const FREE_PLAN: PlanId = "FREE";

export const isPlanId = (value: unknown): value is PlanId => typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
export const isPaidPlanId = (value: unknown): value is PaidPlanId => typeof value === "string" && (PAID_PLAN_IDS as readonly string[]).includes(value);

export const getPlanConfig = (plan: PlanId): PlanConfig => planConfigs[plan];

/** Etiqueta visible de un plan (única fuente: «Gratis», «Esencial», «Premium»). */
export const planLabel = (plan: PlanId): string => planConfigs[plan].name;

/** ¿`plan` incluye lo que ofrece `minimum`? (`ESSENTIAL` incluye lo de `FREE`, no al revés.) */
export const planIncludes = (plan: PlanId, minimum: PlanId): boolean => planConfigs[plan].rank >= planConfigs[minimum].rank;

/** Precio para mostrar: «$499 MXN» (el plan gratuito: «$0 MXN»). Sin lógica de conversión. */
export const formatPrice = (amount: number, currency: string = PRICING_CURRENCY): string => `$${amount.toLocaleString("es-MX")} ${currency}`;
export const formatPlanPrice = (plan: PlanId): string => formatPrice(planConfigs[plan].pricing.displayPrice, planConfigs[plan].pricing.currency);

/** Todas las variables de entorno de precios que la configuración puede usar (para leer y validar el entorno). */
export const PRICE_ENV_KEYS: readonly string[] = PLAN_IDS.flatMap((id) => {
  const { stripePriceEnvKey, upgradeFrom } = planConfigs[id].pricing;
  return [...(stripePriceEnvKey ? [stripePriceEnvKey] : []), ...Object.values(upgradeFrom).map((upgrade) => upgrade.stripePriceEnvKey)];
});
