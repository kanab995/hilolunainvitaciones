import type { Metadata } from "next";
import { AdminOverviewView } from "@/components/admin/overview-view";
import { AdminPageHeader } from "@/components/admin/parts";
import { adminCopy } from "@/lib/admin/copy";
import { getAdminOverview } from "@/server/admin/overview";
import { requireAdmin } from "@/server/auth/admin";

export const metadata: Metadata = { title: adminCopy.overview.title };

/** Resumen de la consola (`/admin`). Solo ADMIN (`requireAdmin`, en cada página). */
export default async function AdminOverviewPage() {
  const admin = await requireAdmin();
  const overview = await getAdminOverview(admin);
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={adminCopy.overview.title} description={adminCopy.overview.description} />
      <AdminOverviewView overview={overview} />
    </div>
  );
}
