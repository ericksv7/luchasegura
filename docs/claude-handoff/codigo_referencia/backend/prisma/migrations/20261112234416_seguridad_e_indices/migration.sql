-- DropForeignKey
ALTER TABLE "Alert" DROP CONSTRAINT "Alert_injuryId_fkey";

-- DropForeignKey
ALTER TABLE "Athlete" DROP CONSTRAINT "Athlete_userId_fkey";

-- DropForeignKey
ALTER TABLE "CompletedSession" DROP CONSTRAINT "CompletedSession_athleteId_fkey";

-- DropForeignKey
ALTER TABLE "Consent" DROP CONSTRAINT "Consent_userId_fkey";

-- DropForeignKey
ALTER TABLE "FunctionalTest" DROP CONSTRAINT "FunctionalTest_athleteId_fkey";

-- DropForeignKey
ALTER TABLE "Injury" DROP CONSTRAINT "Injury_athleteId_fkey";

-- DropForeignKey
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "SessionExercise" DROP CONSTRAINT "SessionExercise_sessionId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Alert_status_createdAt_idx" ON "Alert"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Alert_injuryId_idx" ON "Alert"("injuryId");

-- CreateIndex
CREATE INDEX "Athlete_coachId_idx" ON "Athlete"("coachId");

-- CreateIndex
CREATE INDEX "Consent_userId_idx" ON "Consent"("userId");

-- CreateIndex
CREATE INDEX "FunctionalTest_athleteId_phase_idx" ON "FunctionalTest"("athleteId", "phase");

-- CreateIndex
CREATE INDEX "Injury_athleteId_occurredAt_idx" ON "Injury"("athleteId", "occurredAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "SessionExercise_exerciseId_idx" ON "SessionExercise"("exerciseId");

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Injury" ADD CONSTRAINT "Injury_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_injuryId_fkey" FOREIGN KEY ("injuryId") REFERENCES "Injury"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExercise" ADD CONSTRAINT "SessionExercise_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProgramSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletedSession" ADD CONSTRAINT "CompletedSession_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunctionalTest" ADD CONSTRAINT "FunctionalTest_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Injury" ADD CONSTRAINT "Injury_intensity_range" CHECK ("intensity" IS NULL OR ("intensity" BETWEEN 0 AND 10));
ALTER TABLE "Injury" ADD CONSTRAINT "Injury_daysAbsent_nonneg" CHECK ("daysAbsent" IS NULL OR "daysAbsent" >= 0);