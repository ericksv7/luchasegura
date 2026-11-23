CREATE UNIQUE INDEX "FunctionalTest_baseline_phase_key"
ON "FunctionalTest" ("athleteId", "programId", "interventionStartedAt")
WHERE "version" > 0 AND "testType" = 'BASELINE';
