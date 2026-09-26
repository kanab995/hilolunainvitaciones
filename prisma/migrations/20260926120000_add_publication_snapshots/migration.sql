-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "draftRevision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "lastPublishedAt" TIMESTAMP(3),
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publishedRevision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "publishedVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "InvitationPublication" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "templateSlug" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "mediaAssetIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvitationPublication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvitationPublication_invitationId_isCurrent_idx" ON "InvitationPublication"("invitationId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationPublication_invitationId_version_key" ON "InvitationPublication"("invitationId", "version");

-- AddForeignKey
ALTER TABLE "InvitationPublication" ADD CONSTRAINT "InvitationPublication_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

