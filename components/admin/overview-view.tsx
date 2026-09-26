import Link from "next/link";
import type { ReactNode } from "react";
import { PlanBadge, PurchaseStatusBadge } from "@/components/admin/badges";
import { AdminMetric, AdminPanel, AdminStatList } from "@/components/admin/parts";
import { OrphanAnalyzer } from "@/components/admin/orphan-analyzer";
import { Badge } from "@/components/ui/badge";
import { adminCopy } from "@/lib/admin/copy";
import { formatAdminDate, formatAdminDateTime, formatMinorAmount, formatMinorNumber } from "@/lib/admin/format";
import { PLAN_IDS, planLabel } from "@/lib/billing/plans";
import { routes } from "@/lib/routes";
import type { AdminOverviewDto, HealthItemDto, RevenueSummaryDto } from "@/server/admin/dto";

const copy = adminCopy.overview;
const number = (value: number) => value.toLocaleString("es-MX");

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toLocaleString("es-MX", { maximumFractionDigits: 1 })} ${units[unit]}`;
}

function Revenue({ title, summary }: { title: string; summary: RevenueSummaryDto }) {
  return (
    <div className="flex min-w-0 flex-col gap-1" data-revenue={title}>
      <p className="text-lu-sm text-lu-text-muted">{title}</p>
      <p className="flex flex-wrap items-baseline gap-x-2 text-lu-text tabular-nums">
        <span className="font-lu-display text-lu-title-xl leading-none">{formatMinorNumber(summary.amountMinor)}</span>
        <span className="text-lu-sm text-lu-text-muted">{summary.currency}</span>
      </p>
      <p className="text-lu-xs text-lu-text-muted">{copy.revenueCount(summary.count)}</p>
      {summary.other.length > 0 ? (
        <div role="note" data-revenue-other className="mt-2 flex flex-col gap-0.5 text-lu-xs text-lu-text-secondary">
          <span>{copy.otherCurrencies}</span>
          {summary.other.map((row) => (
            <span key={row.currency} className="tabular-nums">
              {formatMinorAmount(row.amountMinor, row.currency)} · {copy.revenueCount(row.count)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const healthLabels: Record<HealthItemDto["id"], string> = { database: adminCopy.health.database, storage: adminCopy.health.storage, clerk: adminCopy.health.clerk, stripe: adminCopy.health.stripe };

function HealthList({ items }: { items: readonly HealthItemDto[] }) {
  return (
    <ul className="flex flex-col divide-y divide-lu-border-subtle">
      {items.map((item) => (
        <li key={item.id} data-health={item.id} data-configured={item.configured} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-lu-base text-lu-text-secondary">{healthLabels[item.id]}</span>
            <Badge tone={item.configured ? "success" : "pending"} dot>
              {item.configured ? adminCopy.health.configured : adminCopy.health.notConfigured}
            </Badge>
          </div>
          {!item.configured && item.missing.length > 0 ? <span className="text-lu-xs break-words text-lu-text-muted">{adminCopy.health.missing(item.missing)}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function ActivityList({ title, id, empty, children }: { title: string; id: string; empty: boolean; children: ReactNode }) {
  return (
    <AdminPanel id={id} title={title}>
      {empty ? <p className="text-lu-sm text-lu-text-muted">{copy.noActivity}</p> : <ul className="flex flex-col divide-y divide-lu-border-subtle">{children}</ul>}
    </AdminPanel>
  );
}

const rowClass = "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0 text-lu-sm";
const linkClass = "min-w-0 truncate text-lu-base text-lu-text hover:underline";

/** Resumen de la consola (D-33). Todo son cifras reales recibidas ya calculadas (`AdminOverviewDto`); el componente no consulta nada. */
export function AdminOverviewView({ overview }: { overview: AdminOverviewDto }) {
  const { totals, eventsByPlan, revenue, purchaseMix, access, media, health, activity } = overview;
  return (
    <div className="flex flex-col gap-6">
      <section aria-label={copy.metrics} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <AdminMetric label={copy.users} value={number(totals.users)} />
        <AdminMetric label={copy.events} value={number(totals.events)} />
        <AdminMetric label={copy.publishedInvitations} value={number(totals.publishedInvitations)} />
        <AdminMetric label={copy.guests} value={number(totals.guests)} />
        <AdminMetric label={copy.rsvps} value={number(totals.rsvps)} />
        <AdminMetric label={copy.paidPurchases} value={number(totals.paidPurchases)} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminPanel id="admin-revenue" title={copy.revenueTitle} hint={copy.revenueHint}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Revenue title={copy.revenueTotal} summary={revenue.total} />
            <Revenue title={copy.revenue30} summary={revenue.last30Days} />
          </div>
          <AdminStatList
            items={[
              { label: copy.essential, value: number(purchaseMix.essential) },
              { label: copy.premium, value: number(purchaseMix.premium) },
              { label: copy.upgrades, value: number(purchaseMix.upgrades) },
            ]}
          />
        </AdminPanel>

        <AdminPanel id="admin-plans" title={copy.plansTitle} hint={copy.plansHint}>
          <ul className="grid grid-cols-3 gap-3">
            {PLAN_IDS.map((plan) => (
              <li key={plan} data-plan-count={plan} className="flex flex-col gap-2 rounded-lu-input border border-lu-border-subtle bg-lu-surface-muted px-3 py-3">
                <PlanBadge plan={plan} />
                <span className="font-lu-display text-lu-title-xl leading-none tabular-nums">
                  {number(eventsByPlan[plan])}
                  <span className="sr-only"> {planLabel(plan)}</span>
                </span>
              </li>
            ))}
          </ul>
        </AdminPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminPanel id="admin-access" title={copy.accessTitle} hint={copy.accessNote}>
          <AdminStatList
            items={[
              { label: copy.expiringSoon(access.windowDays), value: number(access.expiringSoon) },
              { label: copy.expired, value: number(access.expired) },
            ]}
          />
        </AdminPanel>

        <AdminPanel id="admin-media" title={copy.mediaTitle} hint={copy.mediaNote}>
          <AdminStatList
            items={[
              { label: copy.mediaCount, value: number(media.count) },
              { label: copy.mediaSize, value: formatBytes(media.sizeBytes) },
              { label: copy.mediaStale(media.staleHours), value: number(media.stalePending) },
              { label: copy.mediaUnreferenced, value: media.unreferencedReady === null ? copy.mediaUnavailable : number(media.unreferencedReady) },
            ]}
          />
          <OrphanAnalyzer />
        </AdminPanel>

        <AdminPanel id="admin-health" title={copy.healthTitle} hint={copy.healthNote}>
          <HealthList items={health} />
        </AdminPanel>
      </div>

      <section aria-labelledby="admin-activity" className="flex flex-col gap-4">
        <h2 id="admin-activity" className="font-lu-display text-lu-title-lg text-lu-text">
          {copy.activityTitle}
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ActivityList id="activity-audit" title={adminCopy.audit.recent} empty={activity.audit.length === 0}>
            {activity.audit.map((entry) => (
              <li key={entry.id} className={rowClass}>
                <span className="min-w-0 truncate text-lu-base text-lu-text">
                  {entry.target}
                  <span className="ml-2 text-lu-sm text-lu-text-muted">{entry.changes.map((change) => `${change.field}: ${change.from} → ${change.to}`).join(" · ")}</span>
                </span>
                <span className="text-lu-text-muted">{formatAdminDate(entry.createdAt)}</span>
              </li>
            ))}
          </ActivityList>

          <ActivityList id="activity-users" title={copy.recentUsers} empty={activity.users.length === 0}>
            {activity.users.map((user) => (
              <li key={user.id} className={rowClass}>
                <Link href={routes.adminUser(user.id)} className={linkClass}>
                  {user.name?.trim() || user.email}
                </Link>
                <span className="text-lu-text-muted">{formatAdminDate(user.createdAt)}</span>
              </li>
            ))}
          </ActivityList>

          <ActivityList id="activity-events" title={copy.recentEvents} empty={activity.events.length === 0}>
            {activity.events.map((event) => (
              <li key={event.id} className={rowClass}>
                <Link href={routes.adminEvent(event.id)} className={linkClass}>
                  {event.title}
                </Link>
                <span className="text-lu-text-muted">{formatAdminDate(event.createdAt)}</span>
              </li>
            ))}
          </ActivityList>

          <ActivityList id="activity-publications" title={copy.recentPublications} empty={activity.publications.length === 0}>
            {activity.publications.map((publication) => (
              <li key={publication.id} className={rowClass}>
                <Link href={routes.adminEvent(publication.eventId)} className={linkClass}>
                  {publication.eventTitle}
                </Link>
                <span className="text-lu-text-muted">
                  {copy.versionLabel(publication.version)} · {formatAdminDate(publication.createdAt)}
                </span>
              </li>
            ))}
          </ActivityList>

          <ActivityList id="activity-purchases" title={copy.recentPurchases} empty={activity.purchases.length === 0}>
            {activity.purchases.map((purchase) => (
              <li key={purchase.id} className={rowClass}>
                <Link href={routes.adminPurchase(purchase.id)} className={linkClass}>
                  {purchase.event.title}
                </Link>
                <span className="flex flex-wrap items-center gap-2 text-lu-text-muted">
                  <PlanBadge plan={purchase.plan} />
                  <span className="tabular-nums">{formatMinorAmount(purchase.amountMinor, purchase.currency)}</span>
                  <PurchaseStatusBadge status={purchase.status} />
                </span>
              </li>
            ))}
          </ActivityList>

          <ActivityList id="activity-webhooks" title={copy.recentWebhooks} empty={activity.webhooks.length === 0}>
            {activity.webhooks.map((webhook) => (
              <li key={webhook.id} className={rowClass}>
                <span className="min-w-0 truncate text-lu-base text-lu-text">{webhook.type}</span>
                <span className="text-lu-text-muted">
                  {webhook.maskedExternalEventId} · {formatAdminDateTime(webhook.processedAt)}
                </span>
              </li>
            ))}
          </ActivityList>
        </div>
      </section>
    </div>
  );
}
