-- CreateEnum
CREATE TYPE "AlertEntryKind" AS ENUM ('START', 'REOPEN', 'REVIEW');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AlertStatus" ADD VALUE 'IN_REVIEW';
ALTER TYPE "AlertStatus" ADD VALUE 'FOLLOW_UP_PENDING';

-- AlterTable
ALTER TABLE "Alert" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AlertEntry" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "kind" "AlertEntryKind" NOT NULL,
    "previousStatus" "AlertStatus" NOT NULL,
    "status" "AlertStatus" NOT NULL,
    "observations" TEXT NOT NULL,
    "findings" TEXT,
    "actionTaken" TEXT,
    "recommendations" TEXT,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpDate" DATE,
    "referral" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertEntry_authorId_idx" ON "AlertEntry"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertEntry_alertId_requestId_key" ON "AlertEntry"("alertId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertEntry_alertId_version_key" ON "AlertEntry"("alertId", "version");

-- AddForeignKey
ALTER TABLE "AlertEntry" ADD CONSTRAINT "AlertEntry_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEntry" ADD CONSTRAINT "AlertEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;


-- El contenido mínimo se conserva también ante escrituras fuera de la API.
ALTER TABLE "AlertEntry" ADD CONSTRAINT "AlertEntry_review_content_check" CHECK (
  length(trim("observations")) >= 2 AND
  ("kind" <> 'REVIEW' OR length(trim(coalesce("actionTaken", ''))) >= 2)
);
ALTER TABLE "AlertEntry" ADD CONSTRAINT "AlertEntry_follow_up_check" CHECK (
  "followUpRequired" OR "followUpDate" IS NULL
);
