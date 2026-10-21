import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddonPurchaseHistoryTable, AddonPurchaseStatus } from "@/components/admin/addon-purchases";
import { AdminFacts, AdminPageHeader, AdminPanel } from "@/components/admin/parts";
import { adminCopy } from "@/lib/admin/copy";
import { formatAdminDate, formatAdminDateTime, formatMinorNumber } from "@/lib/admin/format";
import { routes } from "@/lib/routes";
import { getAdminAddonPurchase } from "@/server/admin/addons";
import { requireAdmin } from "@/server/auth/admin";

const copy = adminCopy.addons;
const purchases = adminCopy.purchases;

export const metadata: Metadata = { title: copy.detailTitle };

/**
 * Detalle de una compra de complemento (`/admin/purchases/addons/[id]`, D-48). SOLO LECTURA: sin acciones para reembolsar, desbloquear ni
 * marcar pagos. Muestra si ESTE cobro desbloquea la descarga, si es un duplicado, todo el historial del complemento en el evento y cómo
 * localizar el pago en Stripe (los ids del proveedor salen enmascarados).
 */
export default async function AdminAddonPurchasePage(props: PageProps<"/admin/purchases/addons/[id]">) {
  const admin = await requireAdmin();
  const { id } = await props.params;
  const purchase = await getAdminAddonPurchase(admin, id);
  if (!purchase) notFound();

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title={`${purchase.event.title} · ${copy.products[purchase.addon]}`}
        description={copy.refundNote}
        crumbs={[
          { label: purchases.title, href: routes.adminPurchases },
          { label: copy.title, href: routes.adminAddonPurchases },
        ]}
      />

      {purchase.duplicate ? (
        <p role="status" data-addon-duplicate-note className="rounded-lu-card border border-lu-border-strong bg-lu-surface-muted px-4 py-3 text-lu-sm text-lu-text">
          {copy.duplicateNote}
        </p>
      ) : null}

      <AdminPanel id="addon-purchase-summary" title={copy.detailTitle} hint={purchases.externalIdsNote}>
        <AdminFacts
          items={[
            {
              label: purchases.event,
              value: (
                <Link href={routes.adminEvent(purchase.event.id)} className="hover:underline">
                  {purchase.event.title}
                </Link>
              ),
            },
            {
              label: purchases.user,
              value: (
                <Link href={routes.adminUser(purchase.user.id)} className="hover:underline">
                  {purchase.user.name?.trim() || purchase.user.email}
                </Link>
              ),
            },
            { label: copy.product, value: copy.products[purchase.addon] },
            { label: purchases.status, value: <AddonPurchaseStatus purchase={purchase} /> },
            { label: copy.unlocks, value: purchase.unlocks ? copy.unlocksYes : copy.unlocksNo },
            { label: purchases.amount, value: formatMinorNumber(purchase.amountMinor) },
            { label: purchases.currency, value: purchase.currency },
            { label: purchases.provider, value: purchases.providers[purchase.provider] },
            { label: purchases.paidAt, value: formatAdminDateTime(purchase.paidAt) },
            { label: copy.refundedAt, value: formatAdminDateTime(purchase.refundedAt) },
            { label: purchases.createdAt, value: formatAdminDateTime(purchase.createdAt) },
            { label: purchases.updatedAt, value: formatAdminDateTime(purchase.updatedAt) },
            { label: adminCopy.events.eventDate, value: formatAdminDate(purchase.eventStartsAt) },
            { label: purchases.checkoutSession, value: <code className="font-mono text-lu-sm">{purchase.maskedCheckoutSessionId}</code> },
            { label: purchases.paymentIntent, value: <code className="font-mono text-lu-sm">{purchase.maskedPaymentIntentId}</code> },
            { label: copy.eventId, value: <code className="font-mono text-lu-sm break-all">{purchase.event.id}</code> },
            { label: copy.stripeSearch, value: copy.stripeSearchHint(purchase.event.id) },
          ]}
        />
      </AdminPanel>

      <AdminPanel id="addon-purchase-siblings" title={copy.siblingsTitle}>
        <AddonPurchaseHistoryTable rows={purchase.siblings} caption={copy.siblingsCaption} empty={copy.noPurchases} />
      </AdminPanel>
    </div>
  );
}
