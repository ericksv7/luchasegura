import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "../src/db";
import { calendarDay } from "../src/services/program";
import { catalogueFor, shiftDay, surveyNotice } from "../src/services/preventive-survey";
import { assertIsolatedDatabase } from "./isolated-database";

export const reportPassword = "Informes-sinteticos1";

export async function seedProgramReports(interactiveDemo = false) {
  await assertIsolatedDatabase(prisma);
  const today = calendarDay(new Date());
  const start = shiftDay(today, -60);
  const partialStart = shiftDay(today, -9);
  const past = shiftDay(start, -85);
  const passwordHash = await bcrypt.hash(reportPassword, 4);
  const user = (name: string, role: Role) => prisma.user.create({ data: {
    fullName: name + " · sintético", email: name + "-fase8@example.test", passwordHash, role,
  } });
  const [owner, partial, empty, physio, outsider, coach, admin] = await Promise.all([
    user("completa", "ATHLETE"), user("parcial", "ATHLETE"), user("sin-intervencion", "ATHLETE"),
    user("fisioterapia", "PHYSIO"), user("sin-alcance", "PHYSIO"), user("entrenador", "COACH"), user("administracion", "ADMIN"),
  ]);
  const [athlete, partialAthlete] = await Promise.all([
    prisma.athlete.create({ data: { userId: owner.id, programStartedAt: new Date(start), birthDate: new Date("2000-01-01"), coachId: coach.id } }),
    prisma.athlete.create({ data: { userId: partial.id, programStartedAt: new Date(partialStart), birthDate: new Date("2000-01-01") } }),
    prisma.athlete.create({ data: { userId: empty.id } }),
  ]);
  const program = await prisma.program.create({ data: {
    id: "0000-fase8", name: "Programa preventivo sintético", weeks: 8, sessionsPerWeek: 3,
    sessions: { create: Array.from({ length: 24 }, (_, i) => ({ week: Math.floor(i / 3) + 1, number: i % 3 + 1, minutes: 25 })) },
  }, include: { sessions: { orderBy: [{ week: "asc" }, { number: "asc" }] } } });
  const measure = async (athleteId: string, started: string, phase: "INITIAL" | "FINAL", offset: number, value: number, revised?: number) => {
    const measuredOn = new Date(shiftDay(started, offset));
    const data = { measurements: [{ value }], protocol: "T-DEMO-01" };
    const revision = (version: number, result: typeof data) => ({
      operationId: randomUUID(), authorId: physio.id, authorName: physio.fullName, version,
      measuredOn, result, fingerprint: "synthetic", observations: "Nota reservada de prueba",
    });
    return prisma.functionalTest.create({ data: {
      athleteId, programId: program.id, interventionStartedAt: new Date(started), testType: "T_TEST", phase,
      measuredAt: measuredOn, result: data, version: revised === undefined ? 1 : 2,
      revisions: { create: revised === undefined ? [revision(1, data)] : [revision(1, data), revision(2, { ...data, measurements: [{ value: revised }] })] },
    } });
  };
  await measure(athlete.id, start, "INITIAL", -1, 13, 12);
  await measure(athlete.id, start, "FINAL", 58, 11);
  await measure(athlete.id, past, "FINAL", 56, 15);
  await measure(partialAthlete.id, partialStart, "INITIAL", 0, 16);
  await prisma.completedSession.createMany({ data: program.sessions.filter((_, i) => i % 3 !== 2).map(session => ({
    athleteId: athlete.id, sessionId: session.id, doneAt: new Date(shiftDay(start, (session.week - 1) * 7) + "T15:00:00Z"),
  })) });
  await prisma.injury.create({ data: {
    athleteId: athlete.id, bodyZone: "Rodilla", occurredAt: new Date(shiftDay(start, 8) + "T15:00:00Z"),
    notes: "Observación privada sintética", alerts: { create: { status: "FOLLOW_UP_PENDING", version: 1, entries: { create: {
      authorId: physio.id, authorName: physio.fullName, requestId: randomUUID(), version: 1, kind: "REVIEW",
      previousStatus: "NEW", status: "FOLLOW_UP_PENDING", observations: "Seguimiento privado sintético",
      actionTaken: "Actuación sintética documentada", followUpRequired: true,
      createdAt: new Date(shiftDay(start, 9) + "T15:00:00Z"),
    } } } },
  } });
  for (const [index, sleepTenths] of [80, 0, null, 75].entries()) {
    await prisma.wellbeingEntry.create({ data: {
      athleteId: athlete.id, programId: program.id, startedOn: new Date(start),
      day: new Date(shiftDay(start, index + 8)), week: 2, revisions: { create: {
        operationId: randomUUID(), version: 1, sleepTenths, fatigue: "MILD", recovery: "GOOD",
        fingerprint: "synthetic", notes: "Nota de bienestar privada",
      } },
    } });
  }
  await prisma.preventiveSurveyConsent.create({ data: { athleteId: athlete.id, ...surveyNotice } });
  for (const kind of ["INITIAL", "FINAL"] as const) {
    const first = kind === "INITIAL";
    const snapshot = catalogueFor(kind);
    const from = shiftDay(start, first ? -63 : 0);
    const to = shiftDay(start, first ? -8 : 55);
    await prisma.preventiveSurvey.create({ data: {
      athleteId: athlete.id, respondentId: owner.id, programId: program.id, startedOn: new Date(start), kind,
      catalogue: { ...snapshot, reference: { from, to } }, catalogueVersion: snapshot.version, sportContext: {},
      submittedAt: new Date(shiftDay(start, first ? -1 : 57)), revisions: { create: {
        operationId: randomUUID(), version: 1, actorId: owner.id, fingerprint: "synthetic",
        answers: { injury: first ? "yes" : "no", warmup: first ? "often" : "always", mechanism: "Texto privado sintético" },
      } },
    } });
  }
  await prisma.preventiveSurveyConsent.create({ data: { athleteId: partialAthlete.id, ...surveyNotice } });
  if (interactiveDemo) {
    const birthDate = new Date(shiftDay(today, -20 * 365));
    await prisma.$transaction([
      prisma.athlete.update({
        where: { id: athlete.id },
        data: { birthDate, category: "65 kg", weightKg: 64.5, style: "libre", yearsExperience: 4 },
      }),
      prisma.athlete.update({
        where: { id: partialAthlete.id },
        data: { birthDate, coachId: coach.id, category: "57 kg", weightKg: 56.5, style: "libre", yearsExperience: 2 },
      }),
      prisma.alertRule.create({ data: { minIntensity: 5, createdById: physio.id } }),
    ]);
    const exercises = await prisma.exercise.findMany({
      where: { isBase: true, archived: false }, orderBy: [{ component: "asc" }, { name: "asc" }, { id: "asc" }], take: 3,
    });
    await prisma.sessionExercise.createMany({
      data: program.sessions.flatMap(session => exercises.map((exercise, index) => ({
        sessionId: session.id, exerciseId: exercise.id, position: index + 1,
      }))),
    });
  }
  return { today, start, past, partialStart, owner, partial, empty, athlete, partialAthlete, physio, outsider, coach, admin, program };
}
