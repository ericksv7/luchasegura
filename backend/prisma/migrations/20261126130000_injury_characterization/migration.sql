CREATE TABLE "InjuryCharacterization" (
    "operationId" TEXT NOT NULL,
    "injuryId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB NOT NULL,
    "fingerprint" TEXT NOT NULL,
    CONSTRAINT "InjuryCharacterization_pkey" PRIMARY KEY ("operationId"),
    CONSTRAINT "InjuryCharacterization_injuryId_fkey" FOREIGN KEY ("injuryId") REFERENCES "Injury"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InjuryCharacterization_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InjuryCharacterization_injuryId_version_key" ON "InjuryCharacterization"("injuryId", "version");
CREATE INDEX "InjuryCharacterization_authorId_idx" ON "InjuryCharacterization"("authorId");
