import type { Metadata } from "next";
import Link from "next/link";
import { MusicTrackStatusBadge } from "@/components/admin/badges";
import { AdminTable, type AdminColumn } from "@/components/admin/data-table";
import { CategoryDialog, NewTrackDialog } from "@/components/admin/music-forms";
import { AdminPageHeader, AdminPanel } from "@/components/admin/parts";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/typography";
import { adminCopy } from "@/lib/admin/copy";
import { formatDuration } from "@/lib/music/limits";
import { routes } from "@/lib/routes";
import { listAdminMusic, type AdminMusicTrackDto } from "@/server/admin/music";
import { requireAdmin } from "@/server/auth/admin";
import type { MusicCategoryRow } from "@/server/repositories/music";

const copy = adminCopy.music;

export const metadata: Metadata = { title: copy.title };

const categoryColumns: readonly AdminColumn<MusicCategoryRow>[] = [
  { id: "name", header: copy.categories.name, primary: true, cell: (category) => category.name },
  { id: "slug", header: copy.categories.slug, cell: (category) => <code className="font-mono text-lu-sm">{category.slug}</code> },
  { id: "order", header: copy.categories.order, align: "end", cell: (category) => category.sortOrder },
  { id: "visible", header: copy.categories.visible, cell: (category) => <Badge tone={category.isActive ? "success" : "neutral"}>{category.isActive ? copy.categories.yes : copy.categories.no}</Badge> },
  { id: "tracks", header: copy.categories.tracks, align: "end", cell: (category) => category.trackCount },
  { id: "actions", header: copy.categories.actions, cell: (category) => <CategoryDialog category={category} /> },
];

const trackColumns: readonly AdminColumn<AdminMusicTrackDto>[] = [
  { id: "title", header: copy.tracks.name, primary: true, cell: (track) => track.title },
  { id: "author", header: copy.tracks.author, cell: (track) => track.author },
  { id: "category", header: copy.tracks.category, cell: (track) => track.category.name },
  { id: "status", header: copy.tracks.status, cell: (track) => <MusicTrackStatusBadge status={track.status} /> },
  {
    id: "rights",
    header: copy.tracks.rights,
    cell: (track) => (track.problems.length === 0 ? <Badge tone="success">{copy.tracks.complete}</Badge> : <Badge tone="pending">{copy.tracks.missing(track.problems.length)}</Badge>),
  },
  { id: "duration", header: copy.tracks.duration, align: "end", cell: (track) => formatDuration(track.durationSec) || "—" },
  { id: "selections", header: copy.tracks.selections, align: "end", cell: (track) => track.selectionCount },
  {
    id: "actions",
    header: copy.tracks.actions,
    cell: (track) => (
      <Link href={routes.adminMusicTrack(track.id)} className="text-lu-sm font-medium text-lu-text underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-lu-brown-600">
        {copy.tracks.open}
      </Link>
    ),
  },
];

/**
 * Biblioteca musical (`/admin/music`, D-46). Categorías y pistas con el estado de su documentación de derechos. Crear una pista la deja en
 * BORRADOR: nada aparece en el editor ni suena en una invitación hasta activarla con la documentación completa y verificada.
 */
export default async function AdminMusicPage() {
  const admin = await requireAdmin();
  const { categories, tracks } = await listAdminMusic(admin);
  const options = categories.map((category) => ({ id: category.id, name: category.name }));
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={copy.title} description={copy.description} />
      <Text size="sm" tone="muted">
        {copy.rule}
      </Text>
      <AdminPanel id="music-tracks" title={copy.tracks.title}>
        <div className="flex flex-col gap-4">
          <div>{options.length > 0 ? <NewTrackDialog categories={options} /> : null}</div>
          <AdminTable caption={copy.tracks.caption} columns={trackColumns} rows={tracks} rowKey={(track) => track.id} cards="xl" empty={copy.tracks.empty} />
        </div>
      </AdminPanel>
      <AdminPanel id="music-categories" title={copy.categories.title}>
        <div className="flex flex-col gap-4">
          <div>
            <CategoryDialog />
          </div>
          <AdminTable caption={copy.categories.caption} columns={categoryColumns} rows={categories} rowKey={(category) => category.id} cards="lg" empty={adminCopy.common.noResults} />
        </div>
      </AdminPanel>
    </div>
  );
}
