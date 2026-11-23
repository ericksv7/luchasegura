-- CreateEnum
CREATE TYPE "PreventiveSurveyKind" AS ENUM ('INITIAL', 'FINAL', 'COACH');

-- CreateTable
CREATE TABLE "PreventiveSurvey" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "respondentId" TEXT NOT NULL,
    "startedOn" DATE NOT NULL,
    "kind" "PreventiveSurveyKind" NOT NULL,
    "catalogue" JSONB NOT NULL,
    "catalogueVersion" TEXT NOT NULL,
    "sportContext" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "PreventiveSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreventiveSurveyRevision" (
    "surveyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "operationId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreventiveSurveyRevision_pkey" PRIMARY KEY ("surveyId","version")
);

-- CreateTable
CREATE TABLE "PreventiveSurveyConsent" (
    "athleteId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "PreventiveSurveyConsent_pkey" PRIMARY KEY ("athleteId")
);

-- CreateIndex
CREATE INDEX "PreventiveSurvey_respondentId_startedOn_idx" ON "PreventiveSurvey"("respondentId", "startedOn");

-- CreateIndex
CREATE UNIQUE INDEX "PreventiveSurvey_athleteId_programId_startedOn_kind_respond_key" ON "PreventiveSurvey"("athleteId", "programId", "startedOn", "kind", "respondentId");

-- CreateIndex
CREATE UNIQUE INDEX "PreventiveSurveyRevision_operationId_key" ON "PreventiveSurveyRevision"("operationId");

-- AddForeignKey
ALTER TABLE "PreventiveSurvey" ADD CONSTRAINT "PreventiveSurvey_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreventiveSurvey" ADD CONSTRAINT "PreventiveSurvey_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreventiveSurvey" ADD CONSTRAINT "PreventiveSurvey_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreventiveSurveyRevision" ADD CONSTRAINT "PreventiveSurveyRevision_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "PreventiveSurvey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreventiveSurveyRevision" ADD CONSTRAINT "PreventiveSurveyRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreventiveSurveyConsent" ADD CONSTRAINT "PreventiveSurveyConsent_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "PreventiveSurvey" ADD CONSTRAINT "PreventiveSurvey_version_check"
CHECK ("version" > 0 AND jsonb_typeof("catalogue") = 'object' AND jsonb_typeof("sportContext") = 'object');
ALTER TABLE "PreventiveSurveyRevision" ADD CONSTRAINT "PreventiveSurveyRevision_version_check"
CHECK ("version" > 0 AND jsonb_typeof("answers") = 'object');
ALTER TABLE "PreventiveSurveyConsent" ADD CONSTRAINT "PreventiveSurveyConsent_revocation_check"
CHECK ("revokedAt" IS NULL OR "revokedAt" >= "acceptedAt");
