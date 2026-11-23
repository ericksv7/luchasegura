import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import { app } from "../src/app";
import { prisma } from "../src/db";
import { catalogueFor, shiftDay, surveyNotice, validateAnswers } from "../src/services/preventive-survey";
import { assertIsolatedDatabase } from "./isolated-database";
import { fixturePassword, seedSurveys } from "./preventive-survey-fixture";

const suffix = "fase7-demo";
const email = (role: string) => `${role}-${suffix}@example.test`;
const base = "http://127.0.0.1:4277";

async function initialize() {
  await assertIsolatedDatabase(prisma);
  return prisma.$transaction(async db => {
    const existing = await db.athlete.findFirst({
      where: { user: { email: email("deportista") } }, select: { id: true },
    });
    if (existing) return existing.id;

    const f = await seedSurveys(db, suffix);
    const catalogue = {
      ...catalogueFor("INITIAL"),
      reference: { from: shiftDay(f.starts, -63), to: shiftDay(f.starts, -8) },
    };
    const { answers, invalid } = validateAnswers(catalogue, {
      history: "no", injury: "yes", episodes: 2, mechanism: "Giro durante práctica sintética", warmup: "often",
    }, true);
    assert.deepEqual(invalid, []);
    await db.preventiveSurveyConsent.create({ data: { athleteId: f.athlete.id, ...surveyNotice } });
    await db.preventiveSurvey.create({ data: {
      athleteId: f.athlete.id, programId: f.program.id, respondentId: f.owner.id,
      startedOn: new Date(f.starts), kind: "INITIAL", catalogue, catalogueVersion: catalogue.version,
      sportContext: { experience: 4, category: "Sintética", style: "Libre" },
      version: 2, submittedAt: new Date(), revisions: { create: [
        { actorId: f.owner.id, version: 1, answers: { injury: "yes" }, operationId: randomUUID(), fingerprint: "demo-draft" },
        { actorId: f.owner.id, version: 2, answers, operationId: randomUUID(), fingerprint: "demo-submitted" },
      ] },
    } });
    return f.athlete.id;
  });
}

async function main() {
  const dist = resolve(process.argv[2]);
  const index = resolve(dist, "index.html");
  assert.ok(existsSync(index), "Falta compilar el frontend de demostración.");
  const athleteId = await initialize();

  const site = express();
  site.use((req, res, next) => req.path.startsWith("/api/") ? app(req, res, next) : next());
  site.use(express.static(dist));
  site.get("*", (_req, res) => res.sendFile(index));
  const server = site.listen(4277, "127.0.0.1", () => {
    console.log(`\nBrave: ${base}/login\nContraseña de las tres cuentas: ${fixturePassword}`);
    console.log(`Deportista: ${email("deportista")} · ${base}/deportista/encuestas`);
    for (const role of ["fisioterapia", "entrenador"]) {
      console.log(`${role}: ${email(role)} · ${base}/equipo/deportistas/${athleteId}/encuestas`);
    }
    console.log("Para detener el sitio y PostgreSQL, presiona Ctrl+C en esta terminal.");
  });
  server.on("error", error => { throw error; });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => server.close(() => void prisma.$disconnect()));
  }
}

main().catch(async error => {
  console.error(error.message);
  await prisma.$disconnect();
  process.exitCode = 1;
});
