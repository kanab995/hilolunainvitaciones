import { FileClock, Printer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardPlaceholder } from "@/components/dashboard/dashboard-placeholder";
import { PrintProductCard } from "@/components/print/print-product-card";
import { PrintStudio } from "@/components/print/print-studio";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ADDONS } from "@/lib/billing/addons";
import { loadDashboardPage } from "@/lib/dashboard/load-dashboard";
import { printCopy } from "@/lib/print/copy";
import { routes } from "@/lib/routes";
import { requireAuth } from "@/server/auth/current-user";
import { getPrintPageView } from "@/server/services/print-service";

export const metadata: Metadata = { title: printCopy.page.title };

const copy = printCopy.page;

/**
 * VERSIÓN PARA IMPRIMIR de un evento (D-47, Etapa 2; pantalla aprobada por el propietario sin mockup). Sesión + propiedad
 * (`loadDashboardPage`). Se arma con la invitación PUBLICADA; la vista previa es libre y la compra del archivo está apagada.
 */
export default async function EventPrintPage(props: PageProps<"/dashboard/events/[id]/print">) {
  const { id } = await props.params;
  const data = await loadDashboardPage(id, routes.eventPrint);
  const user = await requireAuth();
  const view = await getPrintPageView(user, data.event.id);
  if (view.status === "not_found") notFound();

  return (
    <DashboardPlaceholder title={copy.title} description={copy.description} eventId={data.event.id} eventTitle={data.event.title}>
      {view.status === "draft" ? (
        <EmptyState
          variant="dashed"
          icon={<FileClock />}
          title={copy.notPublished.title}
          description={copy.notPublished.description}
          action={
            <Button asChild variant="secondary">
              <Link href={routes.eventEdit(data.event.id)}>{copy.notPublished.action}</Link>
            </Button>
          }
        />
      ) : view.status === "unsupported" ? (
        <EmptyState variant="dashed" icon={<Printer />} title={copy.unsupported.title} description={copy.unsupported.description} />
      ) : (
        <div className="flex flex-col gap-6">
          {view.publicationVersion ? <p className="text-lu-sm text-lu-text-muted">{copy.sourceNote(view.publicationVersion)}</p> : null}
          {view.warnings.length > 0 ? (
            <ul role="status" className="flex flex-col gap-1 rounded-lu-card border border-lu-border-subtle bg-lu-surface-tint px-4 py-3">
              {view.warnings.map((warning) => (
                <li key={warning} className="text-lu-sm text-lu-text">
                  {copy.warnings[warning]}
                </li>
              ))}
            </ul>
          ) : null}
          <PrintStudio
            eventId={data.event.id}
            qrAvailable={view.qrAvailable}
            defaultInitials={view.defaultInitials}
            defaultPlace={view.defaultPlace}
            canDownload={view.canDownload}
            product={<PrintProductCard price={view.price} currency={ADDONS.PRINT_FILE.currency} eligible={view.eligible} purchasable={view.purchasable} />}
          />
        </div>
      )}
    </DashboardPlaceholder>
  );
}
