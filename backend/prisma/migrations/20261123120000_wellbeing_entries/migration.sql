BEGIN;

-- CreateEnum
CREATE TYPE "RestPerception" AS ENUM ('VERY_RESTFUL', 'RESTFUL', 'FAIR', 'LITTLE_REST', 'NO_REST');

-- CreateEnum
CREATE TYPE "FatiguePerception" AS ENUM ('NONE', 'MILD', 'MODERATE', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "RecoveryPerception" AS ENUM ('VERY_GOOD', 'GOOD', 'FAIR', 'LOW', 'VERY_LOW');

-- CreateTable
CREATE TABLE "WellbeingEntry" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "startedOn" DATE NOT NULL,
    "day" DATE NOT NULL,
    "week" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WellbeingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellbeingRevision" (
    "operationId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sleepTenths" INTEGER,
    "rest" "RestPerception",
    "fatigue" "FatiguePerception",
    "recovery" "RecoveryPerception",
    "notes" TEXT,
    "fingerprint" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WellbeingRevision_pkey" PRIMARY KEY ("operationId")
);

-- CreateIndex
CREATE INDEX "WellbeingEntry_athleteId_day_id_idx" ON "WellbeingEntry"("athleteId", "day", "id");

-- CreateIndex
CREATE UNIQUE INDEX "WellbeingEntry_athleteId_programId_day_key" ON "WellbeingEntry"("athleteId", "programId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "WellbeingRevision_entryId_version_key" ON "WellbeingRevision"("entryId", "version");

-- AddForeignKey
ALTER TABLE "WellbeingEntry" ADD CONSTRAINT "WellbeingEntry_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellbeingEntry" ADD CONSTRAINT "WellbeingEntry_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellbeingRevision" ADD CONSTRAINT "WellbeingRevision_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WellbeingEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WellbeingEntry" ADD CONSTRAINT "WellbeingEntry_civil_week_check"
CHECK ("day" >= "startedOn" AND "week" = ("day" - "startedOn") / 7 + 1 AND "version" > 0);

ALTER TABLE "WellbeingRevision" ADD CONSTRAINT "WellbeingRevision_values_check"
CHECK ("version" > 0 AND ("sleepTenths" IS NULL OR "sleepTenths" BETWEEN 0 AND 240)
  AND ("notes" IS NULL OR length("notes") <= 500)
  AND num_nonnulls("sleepTenths", "rest", "fatigue", "recovery") > 0);

COMMIT;
