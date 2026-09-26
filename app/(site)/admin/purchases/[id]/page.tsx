import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanBadge, PurchaseKindBadge, PurchaseStatusBadge } from "@/components/admin/badges";
import { AdminFacts, AdminPageHeader, AdminPanel } from "@/components/admin/parts";
import { adminCopy } from "@/lib/admin/copy";
import { formatAdminDate, formatAdminDateTime, formatMinorNumber } from "@/lib/admin/format";
import { routes } from "@/lib/routes";
import { getAdminPurchase } from "@/server/admin/purchases";
import { requireAdmin } from "@/server/auth/admin";

const copy = adminCopy.purchases;

export const metadata: Metadata = { title: copy.detailTitle };

/**
 * Detalle de una compra (`/admin/purchases/[id]`). SOLO LECTURA: no hay acciones para marcarla pagada, crear planes, reembolsar, cancelar ni
 * editar importes. Los ids del proveedor salen ya enmascarados (`cs_••••••wxyz`); nunca hay secretos.
 */
export default async function AdminPurchasePage(props: PageProps<"/admin/purchases/[id]">) {
  const admin = await requireAdmin();
  const { id } = await props.params;
  const purchase = await getAdminPurchase(admin, id);
  if (!purchase) notFound();

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={`${purchase.event.title} · ${adminCopy.purchases.kindLabel[purchase.kind]}`} description={copy.readOnlyNote} crumbs={[{ label: copy.title, href: routes.adminPurchases }]} />

      <AdminPanel id="purchase-summary" title={copy.detailTitle} hint={copy.externalIdsNote}>
        <AdminFacts
          items={[
            {
              label: copy.event,
              value: (
                <Link href={routes.adminEvent(purchase.event.id)} className="hover:underline">
                  {purchase.event.title}
                </Link>
              ),
            },
            {
              label: copy.user,
              value: (
                <Link href={routes.adminUser(purchase.user.id)} className="hover:underline">
                  {purchase.user.name?.trim() || purchase.user.email}
                </Link>
              ),
            },
            { label: copy.plan, value: <PlanBadge plan={purchase.plan} /> },
            { label: copy.kind, value: <PurchaseKindBadge kind={purchase.kind} /> },
            { label: copy.status, value: <PurchaseStatusBadge status={purchase.status} /> },
            { label: copy.amount, value: formatMinorNumber(purchase.amountMinor) },
            { label: copy.currency, value: purchase.currency },
            { label: copy.provider, value: copy.providers[purchase.provider] },
            { label: copy.paidAt, value: formatAdminDateTime(purchase.paidAt) },
            { label: copy.createdAt, value: formatAdminDateTime(purchase.createdAt) },
            { label: copy.updatedAt, value: formatAdminDateTime(purchase.updatedAt) },
            { label: copy.accessStartsAt, value: formatAdminDate(purchase.accessStartsAt) },
            { label: copy.accessEndsAt, value: formatAdminDate(purchase.accessEndsAt) },
            { label: copy.checkoutSession, value: <code className="font-mono text-lu-sm">{purchase.maskedCheckoutSessionId}</code> },
            { label: copy.paymentIntent, value: <code className="font-mono text-lu-sm">{purchase.maskedPaymentIntentId}</code> },
            {
              label: copy.stripeCustomer,
              value: purchase.hasProviderCustomer ? (
                <span>
                  {copy.stripeCustomerPresent} · <code className="font-mono text-lu-sm">{purchase.maskedProviderCustomerId}</code>
                </span>
              ) : (
                copy.stripeCustomerAbsent
              ),
            },
          ]}
        />
      </AdminPanel>
    </div>
  );
}
