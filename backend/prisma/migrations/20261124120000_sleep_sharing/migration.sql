BEGIN;

-- CreateTable
CREATE TABLE "SleepSharing" (
    "athleteId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "noticeVersion" TEXT NOT NULL,
    "noticeDigest" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "SleepSharing_pkey" PRIMARY KEY ("athleteId")
);

-- CreateIndex
CREATE INDEX "SleepSharing_coachId_idx" ON "SleepSharing"("coachId");

-- AddForeignKey
ALTER TABLE "SleepSharing" ADD CONSTRAINT "SleepSharing_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SleepSharing" ADD CONSTRAINT "SleepSharing_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
