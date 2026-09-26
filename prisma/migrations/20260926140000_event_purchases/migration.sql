-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PurchaseKind" AS ENUM ('INITIAL', 'UPGRADE');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "paidAccessEndsAt" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "EventPurchase" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "providerCheckoutSessionId" TEXT NOT NULL,
    "providerPaymentIntentId" TEXT,
    "plan" "Plan" NOT NULL,
    "kind" "PurchaseKind" NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "paidAt" TIMESTAMPTZ,
    "accessStartsAt" TIMESTAMPTZ,
    "accessEndsAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventPurchase_eventId_status_idx" ON "EventPurchase"("eventId", "status");

-- CreateIndex
CREATE INDEX "EventPurchase_userId_idx" ON "EventPurchase"("userId");

-- CreateIndex
CREATE INDEX "EventPurchase_providerPaymentIntentId_idx" ON "EventPurchase"("providerPaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "EventPurchase_provider_providerCheckoutSessionId_key" ON "EventPurchase"("provider", "providerCheckoutSessionId");

-- AddForeignKey
ALTER TABLE "EventPurchase" ADD CONSTRAINT "EventPurchase_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPurchase" ADD CONSTRAINT "EventPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
