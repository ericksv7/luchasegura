-- La fecha real de intervención se registra explícitamente; no se deduce del alta.
ALTER TABLE "Athlete" ADD COLUMN "programStartedAt" DATE;
