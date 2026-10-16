import type { MusicTrackStatusId } from "@/lib/music/limits";

/**
 * DERECHOS DE UNA PISTA (D-46). Regla del propietario: NINGUNA canción se hace pública sin documentación válida de sus derechos
 * (licencia o autorización escrita que cubra alojamiento, reproducción pública y uso comercial dentro de las invitaciones).
 *
 * Este módulo es la única fuente de esa regla en la aplicación; la migración `add_music_library` repite la parte estructural como
 * restricción CHECK de la base de datos (`MusicTrack_active_requires_rights`), así que ni un error de código podría activar una pista
 * sin documentación. Además, una licencia VENCIDA deja de sonar aunque la pista siga `ACTIVE` (la base de datos no conoce la hora).
 * Módulo puro: se prueba sin base de datos.
 */
export interface TrackRightsRecord {
  status: MusicTrackStatusId;
  audioKey: string | null;
  durationSec: number | null;
  licenseSource: string | null;
  licenseName: string | null;
  licenseUrl: string | null;
  licenseTerms: string | null;
  licenseEvidenceRef: string | null;
  rightsHosting: boolean;
  rightsPublicPerformance: boolean;
  rightsCommercialUse: boolean;
  attributionRequired: boolean;
  attributionText: string | null;
  licenseVerifiedAt: Date | null;
  licenseVerifiedById: string | null;
  licenseExpiresAt: Date | null;
}

export const ACTIVATION_PROBLEMS = [
  "audio",
  "licenseSource",
  "licenseName",
  "licenseTerms",
  "licenseEvidence",
  "licenseUrl",
  "rightsHosting",
  "rightsPublicPerformance",
  "rightsCommercialUse",
  "attribution",
  "verification",
  "expired",
] as const;
export type ActivationProblem = (typeof ACTIVATION_PROBLEMS)[number];

const filled = (value: string | null | undefined): boolean => typeof value === "string" && value.trim().length > 0;
const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

/** Datos de licencia (sin el audio ni la verificación): los que el administrador escribe y la verificación certifica. */
export function licenseDocumentationProblems(track: Omit<TrackRightsRecord, "status" | "audioKey" | "durationSec" | "licenseVerifiedAt" | "licenseVerifiedById">, now: Date): ActivationProblem[] {
  const problems: ActivationProblem[] = [];
  if (!filled(track.licenseSource)) problems.push("licenseSource");
  if (!filled(track.licenseName)) problems.push("licenseName");
  if (!filled(track.licenseTerms)) problems.push("licenseTerms");
  if (!filled(track.licenseEvidenceRef)) problems.push("licenseEvidence");
  // La URL es opcional (un contrato firmado no tiene URL), pero si existe debe ser https.
  if (filled(track.licenseUrl) && !isHttpsUrl(track.licenseUrl as string)) problems.push("licenseUrl");
  if (!track.rightsHosting) problems.push("rightsHosting");
  if (!track.rightsPublicPerformance) problems.push("rightsPublicPerformance");
  if (!track.rightsCommercialUse) problems.push("rightsCommercialUse");
  if (track.attributionRequired && !filled(track.attributionText)) problems.push("attribution");
  if (track.licenseExpiresAt && track.licenseExpiresAt.getTime() <= now.getTime()) problems.push("expired");
  return problems;
}

/** Todo lo que falta para poder ACTIVAR la pista (vacío = se puede activar). */
export function activationProblems(track: TrackRightsRecord, now: Date): ActivationProblem[] {
  const problems: ActivationProblem[] = [];
  if (!filled(track.audioKey) || !track.durationSec || track.durationSec <= 0) problems.push("audio");
  problems.push(...licenseDocumentationProblems(track, now));
  if (!track.licenseVerifiedAt || !filled(track.licenseVerifiedById)) problems.push("verification");
  return ACTIVATION_PROBLEMS.filter((problem) => problems.includes(problem));
}

/** ¿Puede SONAR (y ofrecerse en el editor) ahora mismo? Solo `ACTIVE`, con audio y derechos completos y vigentes. */
export const isTrackPlayable = (track: TrackRightsRecord, now: Date): boolean => track.status === "ACTIVE" && activationProblems(track, now).length === 0;
