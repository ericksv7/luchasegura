BEGIN;

ALTER TABLE "Injury" ADD COLUMN "historyDate" DATE;

-- El valor por defecto de ambas marcas era now() en la misma inserción.
-- Los registros con una fecha histórica anterior o distinta conservan el día
-- que mostraba el editor anterior. No se altera ninguna marca temporal.
UPDATE "Injury"
SET "historyDate" = "occurredAt"::date
WHERE "isHistory" AND "occurredAt" <> "createdAt";

COMMIT;
