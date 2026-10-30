-- AlterTable
ALTER TABLE "Presence" ADD COLUMN "peerId" TEXT,
ADD COLUMN "requestTo" TEXT;

-- CreateIndex
CREATE INDEX "Presence_peerId_idx" ON "Presence"("peerId");

-- CreateIndex
CREATE INDEX "Presence_requestTo_idx" ON "Presence"("requestTo");
