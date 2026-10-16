import type { TrackRightsRecord } from "@/lib/music/license";

/** Pista con TODA la documentación (la única forma de poder activarla). */
export const documented = (over: Partial<TrackRightsRecord> = {}): TrackRightsRecord => ({
  status: "DRAFT",
  audioKey: "library/music/trk_1-0123456789abcdef0123456789abcdef.mp3",
  durationSec: 180,
  licenseSource: "Compositora encargada por Hilo Luna",
  licenseName: "Contrato de obra por encargo con cesión de derechos",
  licenseUrl: null,
  licenseTerms: "Cesión para alojamiento, reproducción pública y uso comercial en invitaciones digitales de clientes, sin límite territorial.",
  licenseEvidenceRef: "Contrato firmado 2026-10-20, carpeta Legal/Música",
  rightsHosting: true,
  rightsPublicPerformance: true,
  rightsCommercialUse: true,
  attributionRequired: false,
  attributionText: null,
  licenseVerifiedAt: new Date("2026-10-15T00:00:00Z"),
  licenseVerifiedById: "usr_admin",
  licenseExpiresAt: null,
  ...over,
});
