import { maskExternalId } from "@/lib/admin/mask";
import { PLAN_IDS, PRICING_CURRENCY, type PlanId } from "@/lib/billing/plans";
import { getServerNow } from "@/lib/invitation/server-time";
import type { AdminOverviewDto, RevenueSummaryDto } from "@/server/admin/dto";
import { getSystemHealth } from "@/server/admin/health";
import { toAuditEntry } from "@/server/admin/audit";
import { toPurchaseListItem } from "@/server/admin/purchases";
import type { AdminUser } from "@/server/auth/admin";
import * as repo from "@/server/repositories/admin";

/**
 * RESUMEN DE LA CONSOLA (D-33): cifras reales del producto, todas con `count` / `aggregate` / `groupBy` en la base de datos (nada se
 * cuenta en JavaScript). Reglas:
 *  - Ingresos brutos = SUMA de compras `PAID` (jamás pendientes, fallidas, reembolsadas ni canceladas), sin conversión de divisas: lo que
 *    no sea MXN se muestra aparte, no se suma.
 *  - El plan efectivo por evento usa el mismo criterio que `getEffectiveEventPlan` (mayor plan de sus compras pagadas).
 *  - Sin tabla de actividad: la actividad reciente son las últimas filas de las tablas reales.
 */
const ACCESS_WINDOW_DAYS = 30;
const REVENUE_WINDOW_DAYS = 30;
const STALE_UPLOAD_HOURS = 24;
const RECENT = 5;

export function summarizeRevenue(rows: readonly repo.RevenueRow[]): RevenueSummaryDto {
  const primary = rows.find((row) => row.currency === PRICING_CURRENCY);
  return {
    currency: PRICING_CURRENCY,
    amountMinor: primary?.amountMinor ?? 0,
    count: primary?.count ?? 0,
    other: rows.filter((row) => row.currency !== PRICING_CURRENCY).map(({ currency, amountMinor, count }) => ({ currency, amountMinor, count })),
  };
}

export async function getAdminOverview(_admin: AdminUser, now: Date = new Date(getServerNow())): Promise<AdminOverviewDto> {
  const since = new Date(now.getTime() - REVENUE_WINDOW_DAYS * 86_400_000);
  const [totals, planCounts, revenueAll, revenueRecent, mix, access, media, users, events, publications, purchases, webhooks, audit] = await Promise.all([
    repo.countTotals(),
    Promise.all(PLAN_IDS.map(async (plan) => [plan, await repo.countEventsForPlan(plan)] as const)),
    repo.sumPaidRevenue(),
    repo.sumPaidRevenue(since),
    repo.countPaidPurchasesByPlanAndKind(),
    repo.countPaidAccessWindows(now, ACCESS_WINDOW_DAYS),
    repo.getMediaTotals(now, STALE_UPLOAD_HOURS),
    repo.listRecentUsers(RECENT),
    repo.listRecentEvents(RECENT),
    repo.listRecentPublications(RECENT),
    repo.listRecentPurchases(RECENT),
    repo.listRecentWebhookEvents(RECENT),
    repo.listRecentAuditLog(RECENT),
  ]);

  const countOf = (predicate: (row: repo.PurchaseMixRow) => boolean) => mix.filter(predicate).reduce((sum, row) => sum + row.count, 0);

  return {
    generatedAt: now,
    totals,
    eventsByPlan: Object.fromEntries(planCounts) as Record<PlanId, number>,
    revenue: { total: summarizeRevenue(revenueAll), last30Days: summarizeRevenue(revenueRecent) },
    purchaseMix: {
      essential: countOf((row) => row.plan === "ESSENTIAL" && row.kind === "INITIAL"),
      premium: countOf((row) => row.plan === "PREMIUM" && row.kind === "INITIAL"),
      upgrades: countOf((row) => row.kind === "UPGRADE"),
    },
    access: { windowDays: ACCESS_WINDOW_DAYS, ...access },
    media: { count: media.count, sizeBytes: media.sizeBytes, stalePending: media.stalePending, staleHours: STALE_UPLOAD_HOURS, unreferencedReady: media.unreferencedReady },
    health: getSystemHealth(),
    activity: {
      audit: audit.map(toAuditEntry),
      users,
      events,
      publications,
      purchases: purchases.map(toPurchaseListItem),
      webhooks: webhooks.map((row) => ({ id: row.id, provider: row.provider, maskedExternalEventId: maskExternalId(row.externalEventId), type: row.type, processedAt: row.processedAt })),
    },
  };
}
