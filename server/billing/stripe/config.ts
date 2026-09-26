import { PRICE_ENV_KEYS } from "@/lib/billing/plans";

/**
 * CONFIGURACIÓN DE STRIPE desde variables de entorno (D-32: pago único por evento). Lógica pura sobre un objeto de entorno (se prueba
 * sin tocar `process.env`). Nunca se registran valores: los problemas nombran VARIABLES. Reglas:
 *  - Sin `STRIPE_SECRET_KEY` → no configurado (la app sigue como Gratis; sin caídas al arrancar).
 *  - Para COBRAR hacen falta: clave secreta, secreto de webhook (si no, se cobraría sin poder activar el plan) y al menos un precio.
 *    Los precios se resuelven solo aquí (variable de `lib/billing/plans.ts` → `price_…`), jamás desde el cliente.
 *  - Coherencia detectable: las claves de Stripe llevan su modo (`sk_test_` / `sk_live_`, `pk_test_` / `pk_live_`); una clave secreta y
 *    una pública de modos distintos es una configuración inconsistente. (El modo y la moneda de un `price_…` no son detectables
 *    localmente: el webhook rechaza cualquier cobro que no sea en MXN y por el importe configurado.)
 */
export type StripeEnv = Readonly<Record<string, string | undefined>>;

export type StripeMode = "test" | "live";

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  mode: StripeMode;
  /** Variable de precio (`STRIPE_PRICE_…`) → `price_…` de Stripe. */
  prices: ReadonlyMap<string, string>;
}

export type StripeConfigResult = { status: "ready"; config: StripeConfig } | { status: "not_configured" } | { status: "invalid"; problems: string[] };

const clean = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const modeOf = (key: string, prefixes: readonly string[]): StripeMode | undefined => {
  if (prefixes.some((prefix) => key.startsWith(`${prefix}_test_`))) return "test";
  if (prefixes.some((prefix) => key.startsWith(`${prefix}_live_`))) return "live";
  return undefined;
};

const NAMES = ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET", ...PRICE_ENV_KEYS] as const;

/** Lee solo las variables de Stripe del entorno del proceso. */
export function readStripeEnv(env: NodeJS.ProcessEnv = process.env): StripeEnv {
  return Object.fromEntries(NAMES.map((name) => [name, env[name]]));
}

export function resolveStripeConfig(env: StripeEnv = readStripeEnv()): StripeConfigResult {
  const secretKey = clean(env.STRIPE_SECRET_KEY);
  if (!secretKey) return { status: "not_configured" };

  const problems: string[] = [];
  const secretMode = modeOf(secretKey, ["sk", "rk"]);
  if (!secretMode) problems.push("STRIPE_SECRET_KEY no tiene el formato de una clave de Stripe (sk_test_… / sk_live_…).");

  const publishable = clean(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  if (publishable) {
    const publishableMode = modeOf(publishable, ["pk"]);
    if (!publishableMode) problems.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY no tiene el formato de una clave pública de Stripe (pk_test_… / pk_live_…).");
    else if (secretMode && publishableMode !== secretMode) problems.push("STRIPE_SECRET_KEY y NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY son de modos distintos (test / live).");
  }

  const webhookSecret = clean(env.STRIPE_WEBHOOK_SECRET);
  if (!webhookSecret) problems.push("Falta STRIPE_WEBHOOK_SECRET: sin él no se podrían activar los planes tras el pago.");
  else if (!webhookSecret.startsWith("whsec_")) problems.push("STRIPE_WEBHOOK_SECRET no tiene el formato de un secreto de webhook (whsec_…).");

  const prices = new Map<string, string>();
  for (const variable of PRICE_ENV_KEYS) {
    const value = clean(env[variable]);
    if (!value) continue;
    if (!value.startsWith("price_")) {
      problems.push(`${variable} no tiene el formato de un precio de Stripe (price_…).`);
      continue;
    }
    prices.set(variable, value);
  }
  if (prices.size === 0) problems.push("No hay ningún precio configurado (STRIPE_PRICE_ESSENTIAL_ONE_TIME / STRIPE_PRICE_PREMIUM_ONE_TIME).");
  // Un mismo precio para dos conceptos haría que el webhook no pudiera distinguirlos.
  if (new Set(prices.values()).size !== prices.size) problems.push("Dos conceptos comparten el mismo precio de Stripe.");

  if (problems.length > 0 || !secretMode || !webhookSecret) return { status: "invalid", problems };
  return { status: "ready", config: { secretKey, webhookSecret, mode: secretMode, prices } };
}
