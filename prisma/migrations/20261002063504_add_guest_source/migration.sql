-- CreateEnum
CREATE TYPE "GuestSource" AS ENUM ('HOST', 'PUBLIC_RSVP');

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "source" "GuestSource" NOT NULL DEFAULT 'HOST';

-- CreateIndex
CREATE INDEX "Guest_eventId_source_idx" ON "Guest"("eventId", "source");
