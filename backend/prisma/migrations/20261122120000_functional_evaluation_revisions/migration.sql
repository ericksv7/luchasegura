BEGIN;

ALTER TABLE "FunctionalTest"
ADD COLUMN "programId" TEXT,
ADD COLUMN "interventionStartedAt" DATE,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "FunctionalTestRevision" (
    "operationId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "measuredOn" DATE NOT NULL,
    "result" JSONB NOT NULL,
    "observations" TEXT,
    "fingerprint" TEXT NOT NULL,
    CONSTRAINT "FunctionalTestRevision_pkey" PRIMARY KEY ("operationId")
);

CREATE UNIQUE INDEX "FunctionalTestRevision_testId_version_key" ON "FunctionalTestRevision"("testId", "version");
CREATE INDEX "FunctionalTestRevision_authorId_idx" ON "FunctionalTestRevision"("authorId");

ALTER TABLE "FunctionalTest" ADD CONSTRAINT "FunctionalTest_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FunctionalTestRevision" ADD CONSTRAINT "FunctionalTestRevision_testId_fkey" FOREIGN KEY ("testId") REFERENCES "FunctionalTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FunctionalTestRevision" ADD CONSTRAINT "FunctionalTestRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
