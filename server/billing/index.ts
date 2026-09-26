import Stripe from "stripe";
import { siteConfig } from "@/lib/site-config";
import type { BillingProviderState } from "@/server/billing/provider";
import { resolveStripeConfig } from "@/server/billing/stripe/config";
import { StripeBillingProvider } from "@/server/billing/stripe/stripe-provider";
import { logger } from "@/server/observability/logger";

/**
 * PROVEEDOR DE COBRO ACTIVO (D-31). Único punto que decide qué adaptador se usa (hoy solo Stripe) y si la configuración de
 * este entorno permite cobrar. Sin configuración → `not_configured` (la app sigue como FREE, sin fallar al arrancar);
 * con configuración inconsistente → `invalid` (se registra qué VARIABLES fallan, nunca sus valores). El cliente del SDK
 * se crea una vez por proceso.
 */
let cached: { key: string; state: BillingProviderState } | undefined;
const reported = new Set<string>();

export function getBillingProviderState(): BillingProviderState {
  const resolved = resolveStripeConfig();
  const key = JSON.stringify(resolved.status === "ready" ? [resolved.config.secretKey, resolved.config.webhookSecret, [...resolved.config.prices]] : resolved);
  if (cached?.key === key) return cached.state;

  let state: BillingProviderState;
  if (resolved.status === "ready") {
    state = { status: "ready", provider: new StripeBillingProvider(new Stripe(resolved.config.secretKey, { maxNetworkRetries: 2, appInfo: { name: siteConfig.name } }), resolved.config) };
  } else if (resolved.status === "invalid") {
    const summary = resolved.problems.join(" | ");
    if (!reported.has(summary)) {
      reported.add(summary);
      logger.error("billing.config_invalid", undefined, { problems: summary });
    }
    state = { status: "invalid", problems: resolved.problems };
  } else {
    state = { status: "not_configured" };
  }
  cached = { key, state };
  return state;
}
