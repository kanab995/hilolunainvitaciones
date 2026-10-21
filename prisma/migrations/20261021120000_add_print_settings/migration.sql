-- D-49: preferencias de la versión impresa por evento (hoy, el destino del QR). Migración ADITIVA: un enum y una tabla nuevos. No toca
-- eventos, invitaciones, publicaciones, mesas de regalos, compras ni precios. Sin filas al aplicarla: los eventos existentes conservan el QR
-- hacia la invitación (sin fila = valor por defecto).

-- CreateEnum
CREATE TYPE "PrintQrTarget" AS ENUM ('INVITATION', 'GIFT_REGISTRY', 'GIFT_REGISTRY_LINK', 'NONE');

-- CreateTable
CREATE TABLE "PrintSettings" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "qrTarget" "PrintQrTarget" NOT NULL DEFAULT 'INVITATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrintSettings_eventId_key" ON "PrintSettings"("eventId");

-- AddForeignKey
ALTER TABLE "PrintSettings" ADD CONSTRAINT "PrintSettings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
