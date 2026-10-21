-- D-46 · Biblioteca musical (Etapa 1). Migración ADITIVA: tablas nuevas, una columna con valor por defecto y una clave foránea
-- sobre "MusicSettings"."libraryTrackId" (hoy siempre nulo: la biblioteca nunca estuvo disponible). No reescribe datos de clientes.

-- CreateEnum
CREATE TYPE "MusicTrackStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISABLED');

-- AlterTable
ALTER TABLE "MusicSettings" ADD COLUMN     "isEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "MusicCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicTrack" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "status" "MusicTrackStatus" NOT NULL DEFAULT 'DRAFT',
    "audioKey" TEXT,
    "audioMimeType" TEXT,
    "audioSizeBytes" INTEGER,
    "durationSec" INTEGER,
    "licenseSource" TEXT,
    "licenseName" TEXT,
    "licenseUrl" TEXT,
    "licenseTerms" TEXT,
    "licenseEvidenceRef" TEXT,
    "rightsHosting" BOOLEAN NOT NULL DEFAULT false,
    "rightsPublicPerformance" BOOLEAN NOT NULL DEFAULT false,
    "rightsCommercialUse" BOOLEAN NOT NULL DEFAULT false,
    "attributionRequired" BOOLEAN NOT NULL DEFAULT false,
    "attributionText" TEXT,
    "licenseVerifiedAt" TIMESTAMPTZ,
    "licenseVerifiedById" TEXT,
    "licenseExpiresAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicTrack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MusicCategory_slug_key" ON "MusicCategory"("slug");

-- CreateIndex
CREATE INDEX "MusicCategory_sortOrder_idx" ON "MusicCategory"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MusicTrack_audioKey_key" ON "MusicTrack"("audioKey");

-- CreateIndex
CREATE INDEX "MusicTrack_status_categoryId_idx" ON "MusicTrack"("status", "categoryId");

-- CreateIndex
CREATE INDEX "MusicSettings_libraryTrackId_idx" ON "MusicSettings"("libraryTrackId");

-- AddForeignKey
ALTER TABLE "MusicSettings" ADD CONSTRAINT "MusicSettings_libraryTrackId_fkey" FOREIGN KEY ("libraryTrackId") REFERENCES "MusicTrack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicTrack" ADD CONSTRAINT "MusicTrack_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MusicCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MusicTrack" ADD CONSTRAINT "MusicTrack_licenseVerifiedById_fkey" FOREIGN KEY ("licenseVerifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defensa en profundidad: la BASE DE DATOS rechaza una pista ACTIVE sin audio ni documentación de derechos completa (la misma regla que
-- lib/music/license.ts aplica en la consola). Ninguna pista puede hacerse pública por un error de código.
ALTER TABLE "MusicTrack" ADD CONSTRAINT "MusicTrack_active_requires_rights" CHECK (
  "status" <> 'ACTIVE' OR (
    "audioKey" IS NOT NULL AND "durationSec" IS NOT NULL
    AND "licenseSource" IS NOT NULL AND "licenseName" IS NOT NULL AND "licenseTerms" IS NOT NULL AND "licenseEvidenceRef" IS NOT NULL
    AND "rightsHosting" AND "rightsPublicPerformance" AND "rightsCommercialUse"
    AND "licenseVerifiedAt" IS NOT NULL AND "licenseVerifiedById" IS NOT NULL
    AND (NOT "attributionRequired" OR "attributionText" IS NOT NULL)
  )
);

-- Categorías iniciales (aprobadas por el propietario). Idempotente; sin pistas: ninguna canción se publica en esta etapa.
INSERT INTO "MusicCategory" ("id", "slug", "name", "sortOrder", "isActive", "updatedAt") VALUES
  ('mcat_romantica', 'romantica', 'Romántica', 10, true, CURRENT_TIMESTAMP),
  ('mcat_instrumental', 'instrumental', 'Instrumental', 20, true, CURRENT_TIMESTAMP),
  ('mcat_elegante', 'elegante', 'Elegante', 30, true, CURRENT_TIMESTAMP),
  ('mcat_alegre', 'alegre', 'Alegre', 40, true, CURRENT_TIMESTAMP),
  ('mcat_infantil', 'infantil', 'Infantil', 50, true, CURRENT_TIMESTAMP),
  ('mcat_ambiental', 'ambiental', 'Ambiental', 60, true, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
