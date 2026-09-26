import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanBadge, PublicationBadge, PurchaseStatusBadge, RoleBadge } from "@/components/admin/badges";
import { AdminTable, type AdminColumn } from "@/components/admin/data-table";
import { AdminFacts, AdminPageHeader, AdminPanel } from "@/components/admin/parts";
import { adminCopy } from "@/lib/admin/copy";
import { formatAdminDate, formatAdminDateTime, formatMinorAmount } from "@/lib/admin/format";
import { planLabel } from "@/lib/billing/plans";
import { routes } from "@/lib/routes";
import type { AdminUserEventDto } from "@/server/admin/dto";
import { getAdminUser } from "@/server/admin/users";
import { requireAdmin } from "@/server/auth/admin";

const copy = adminCopy.users;

export const metadata: Metadata = { title: copy.detailTitle };

const columns: readonly AdminColumn<AdminUserEventDto>[] = [
  {
    id: "event",
    header: adminCopy.events.event,
    primary: true,
    cell: (event) => (
      <Link href={routes.adminEvent(event.id)} className="hover:underline">
        {event.title}
      </Link>
    ),
  },
  { id: "date", header: adminCopy.events.eventDate, cell: (event) => formatAdminDate(event.startsAt) },
  { id: "plan", header: adminCopy.events.effectivePlan, cell: (event) => <PlanBadge plan={event.plan} /> },
  { id: "state", header: adminCopy.events.publicationState, cell: (event) => <PublicationBadge state={event.publication} /> },
  {
    id: "purchases",
    header: adminCopy.nav.purchases,
    className: "min-w-56",
    cell: (event) =>
      event.purchases.length === 0 ? (
        adminCopy.common.none
      ) : (
        <ul className="flex flex-col gap-1">
          {event.purchases.map((purchase) => (
            <li key={purchase.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lu-xs">
              <Link href={routes.adminPurchase(purchase.id)} className="hover:underline">
                {planLabel(purchase.plan)} · {formatMinorAmount(purchase.amountMinor, purchase.currency)}
              </Link>
              <PurchaseStatusBadge status={purchase.status} />
            </li>
          ))}
        </ul>
      ),
  },
];

/** Detalle de un usuario (`/admin/users/[id]`). Sin secretos, contraseñas, tokens de invitación ni datos de tarjeta; el rol es de solo lectura. */
export default async function AdminUserPage(props: PageProps<"/admin/users/[id]">) {
  const admin = await requireAdmin();
  const { id } = await props.params;
  const user = await getAdminUser(admin, id);
  if (!user) notFound();

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={user.name?.trim() || user.email} description={copy.detailTitle} crumbs={[{ label: copy.title, href: routes.adminUsers }]} />

      <AdminPanel id="user-account" title={copy.identity} hint={copy.roleNote}>
        <AdminFacts
          items={[
            { label: copy.name, value: user.name?.trim() || adminCopy.common.unnamed },
            { label: copy.email, value: user.email },
            { label: copy.role, value: <RoleBadge role={user.role} /> },
            { label: copy.clerk, value: user.clerkLinked ? copy.clerkLinked : copy.clerkUnlinked },
            { label: copy.stripeCustomer, value: user.hasBillingCustomer ? adminCopy.common.yes : adminCopy.common.no },
            { label: copy.createdAt, value: formatAdminDateTime(user.createdAt) },
            { label: copy.events, value: user.eventCount },
          ]}
        />
      </AdminPanel>

      <AdminPanel id="user-events" title={copy.eventsTitle} hint={user.eventCount > user.events.length ? copy.eventsLimit(user.events.length, user.eventCount) : undefined}>
        <AdminTable caption={copy.eventsCaption} columns={columns} rows={user.events} rowKey={(event) => event.id} cards="xl" empty={copy.noEvents} />
      </AdminPanel>
    </div>
  );
}
