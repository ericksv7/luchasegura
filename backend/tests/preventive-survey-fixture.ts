import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "../src/db";
import { shiftDay } from "../src/services/preventive-survey";
import { calendarDay } from "../src/services/program";
import { assertIsolatedDatabase } from "./isolated-database";

export const fixturePassword = "Encuestas-sinteticas1";
export async function seedSurveys() {
  await assertIsolatedDatabase(prisma);
  const today = calendarDay(new Date());
  const starts = shiftDay(today, 3);
  const past = shiftDay(today, -57);
  const suffix = randomUUID().slice(0, 8);
  const hash = await bcrypt.hash(fixturePassword, 4);
  const user = (name: string, role: Role) => prisma.user.create({ data: {
    fullName: name, email: `${name}-${suffix}@example.test`, role, passwordHash: hash,
  } });
  const [owner, other, minor, physio, coach, admin, unrelated] = await Promise.all([
    user("deportista", "ATHLETE"), user("otro", "ATHLETE"), user("menor", "ATHLETE"), user("fisioterapia", "PHYSIO"),
    user("entrenador", "COACH"), user("administracion", "ADMIN"), user("sin-alcance", "PHYSIO"),
  ]);
  const athlete = await prisma.athlete.create({ data: {
    userId: owner.id, coachId: coach.id, birthDate: new Date("1999-01-01"),
    programStartedAt: new Date(starts), yearsExperience: 4, category: "Sintética", style: "Libre",
  } });
  const prior = await prisma.athlete.create({ data: {
    userId: other.id, birthDate: new Date("1999-01-01"), programStartedAt: new Date(past),
  } });
  await prisma.athlete.create({ data: { userId: minor.id, birthDate: new Date(shiftDay(today, -3650)), programStartedAt: new Date(starts) } });
  const program = await prisma.program.create({ data: {
    id: "000-encuestas-" + suffix, name: "Programa sintético", weeks: 8, sessions: { create: { week: 1, number: 1 } },
  } });
  await prisma.functionalTest.create({ data: {
    athleteId: athlete.id, testType: "T_TEST", phase: "INITIAL", result: {}, version: 1,
    revisions: { create: {
      authorId: physio.id, authorName: "Fisioterapia sintética", measuredOn: new Date(today),
      operationId: randomUUID(), version: 1, result: {}, fingerprint: "fixture",
    } },
  } });
  return { owner, other, minor, physio, coach, admin, unrelated, athlete, prior, program, today, starts, past };
}
