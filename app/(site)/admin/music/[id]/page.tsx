import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MusicTrackStatusBadge } from "@/components/admin/badges";
import { AudioUploader, LicenseForm, StatusForm, TrackMetadataForm, VerifyForm } from "@/components/admin/music-forms";
import { AdminFacts, AdminPageHeader, AdminPanel } from "@/components/admin/parts";
import { Text } from "@/components/ui/typography";
import { adminCopy } from "@/lib/admin/copy";
import { formatAdminDateTime } from "@/lib/admin/format";
import { formatDuration } from "@/lib/music/limits";
import { routes } from "@/lib/routes";
import { getAdminMusicTrack } from "@/server/admin/music";
import { requireAdmin } from "@/server/auth/admin";

const copy = adminCopy.music;

export const metadata: Metadata = { title: copy.title };

const isoDate = (date: Date | null): string => (date ? date.toISOString().slice(0, 10) : "");

/**
 * Detalle de una pista (`/admin/music/[id]`, D-46): datos, audio, licencia, verificación y publicación. La lista de requisitos para activar
 * sale de la MISMA regla que aplica el servidor (`activationProblems`).
 */
export default async function AdminMusicTrackPage(props: PageProps<"/admin/music/[id]">) {
  const admin = await requireAdmin();
  const { id } = await props.params;
  const found = await getAdminMusicTrack(admin, id);
  if (!found) notFound();
  const { track, categories } = found;
  const d = copy.detail;
  const active = track.status === "ACTIVE";
  const documentationOnly = track.problems.filter((problem) => problem !== "audio" && problem !== "verification");

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={track.title} description={track.author} crumbs={[{ label: copy.title, href: routes.adminMusic }]} actions={<MusicTrackStatusBadge status={track.status} />} />

      <AdminPanel id="music-status" title={d.statusTitle}>
        <div className="flex flex-col gap-4">
          <div>
            <Text size="sm" className="font-medium">
              {d.checklist}
            </Text>
            {track.problems.length === 0 ? (
              <Text size="sm" tone="muted">
                {d.ready}
              </Text>
            ) : (
              <ul className="mt-1 list-disc pl-5 text-lu-sm text-lu-text-secondary" data-music-problems>
                {track.problems.map((problem) => (
                  <li key={problem}>{d.problems[problem] ?? problem}</li>
                ))}
              </ul>
            )}
          </div>
          <StatusForm trackId={track.id} status={track.status} canActivate={track.problems.length === 0} />
        </div>
      </AdminPanel>

      <AdminPanel id="music-metadata" title={d.metadata}>
        <TrackMetadataForm trackId={track.id} track={{ title: track.title, author: track.author, categoryId: track.categoryId }} categories={categories.map((category) => ({ id: category.id, name: category.name }))} />
      </AdminPanel>

      <AdminPanel id="music-audio" title={d.audio}>
        <div className="flex flex-col gap-4">
          {track.audioUrl ? (
            <>
              {/* Solo en la consola: el administrador escucha lo que subió. `preload="none"`: nada se descarga hasta pulsar. */}
              <audio controls preload="none" src={track.audioUrl} className="w-full max-w-md" />
              <AdminFacts items={[{ label: copy.tracks.duration, value: formatDuration(track.durationSec) || "—" }, { label: "MB", value: track.audioSizeBytes ? (track.audioSizeBytes / 1_048_576).toFixed(2) : "—" }]} />
            </>
          ) : (
            <Text size="sm" tone="muted">
              {d.audioMissing}
            </Text>
          )}
          <AudioUploader trackId={track.id} locked={active} />
        </div>
      </AdminPanel>

      <AdminPanel id="music-license" title={d.license}>
        <LicenseForm
          trackId={track.id}
          locked={active}
          values={{
            licenseSource: track.licenseSource,
            licenseName: track.licenseName,
            licenseUrl: track.licenseUrl,
            licenseTerms: track.licenseTerms,
            licenseEvidenceRef: track.licenseEvidenceRef,
            rightsHosting: track.rightsHosting,
            rightsPublicPerformance: track.rightsPublicPerformance,
            rightsCommercialUse: track.rightsCommercialUse,
            attributionRequired: track.attributionRequired,
            attributionText: track.attributionText,
            licenseExpiresAt: isoDate(track.licenseExpiresAt),
          }}
        />
      </AdminPanel>

      <AdminPanel id="music-verification" title={d.verification} hint={d.verifyHint}>
        <div className="flex flex-col gap-3">
          <Text size="sm" tone="muted">
            {track.licenseVerifiedAt ? d.verified(track.verifiedBy?.name?.trim() || track.verifiedBy?.email || "—", formatAdminDateTime(track.licenseVerifiedAt)) : d.notVerified}
          </Text>
          <VerifyForm trackId={track.id} disabled={active || documentationOnly.length > 0} />
        </div>
      </AdminPanel>
    </div>
  );
}
