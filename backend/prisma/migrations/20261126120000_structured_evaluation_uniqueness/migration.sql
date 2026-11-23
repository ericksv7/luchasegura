-- The legacy instruments can contain several records per phase.
CREATE UNIQUE INDEX "FunctionalTest_structured_phase_key"
ON "FunctionalTest" ("athleteId", "programId", "interventionStartedAt", "phase", "testType")
WHERE "version" > 0 AND "testType" IN ('FMS', 'LESS');
