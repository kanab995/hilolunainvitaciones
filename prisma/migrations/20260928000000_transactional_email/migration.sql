-- CreateEnum
CREATE TYPE "EmailDeliveryKind" AS ENUM ('RSVP_NOTIFICATION', 'PURCHASE_CONFIRMATION', 'UPGRADE_CONFIRMATION');

-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "EmailDelivery" (
    "id" TEXT NOT NULL,
    "kind" "EmailDeliveryKind" NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "eventId" TEXT,
    "purchaseId" TEXT,
    "rsvpId" TEXT,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "errorCode" TEXT,
    "attemptedAt" TIMESTAMPTZ,
    "sentAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailDelivery_recipientUserId_createdAt_idx" ON "EmailDelivery"("recipientUserId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDelivery_status_idx" ON "EmailDelivery"("status");

-- CreateIndex
CREATE INDEX "EmailDelivery_eventId_idx" ON "EmailDelivery"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDelivery_kind_purchaseId_key" ON "EmailDelivery"("kind", "purchaseId");

-- AddForeignKey
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
