import { ActivityCard, ActivityItem } from "@/components/dashboard/activity-card";
import { dashboardCopy } from "@/lib/dashboard/copy";
import { describeActivity, formatRelativeTime } from "@/lib/dashboard/format";
import { routes } from "@/lib/routes";
import type { EventActivity } from "@/types/dashboard";

/**
 * Actividad reciente (mockup 05). Se dibuja desde un arreglo tipado: la frase sale de `type` +
 * `metadata` (`describeActivity`) y el tiempo relativo de `occurredAt` y la hora `now`.
 */
export function RecentActivity({ activity, eventId, now }: { activity: readonly EventActivity[]; eventId: string; now: number }) {
  return (
    <ActivityCard title={dashboardCopy.activity.title} action={{ label: dashboardCopy.activity.action, href: routes.eventRsvp(eventId) }}>
      {activity.length === 0 ? (
        <li className="py-6 text-lu-sm text-lu-text-muted">{dashboardCopy.activity.empty}</li>
      ) : (
        activity.map((item) => {
          const time = formatRelativeTime(item.occurredAt, now);
          return <ActivityItem key={item.id} name={item.actorName} action={describeActivity(item)} detail={time.long} time={time.short} />;
        })
      )}
    </ActivityCard>
  );
}
