import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import bcrypt from "bcryptjs";
import type { Prisma, Role, TestPhase } from "@prisma/client";
import { prisma } from "../src/db";
import { calendarDay } from "../src/services/program";
import { shiftDay } from "../src/services/preventive-survey";
import { fmsPatterns, fmsProtocol, lessProtocol, scoreAssessment } from "../src/services/structured-evaluation";

const programId = "presentacion-academica-v1";
const accounts = [
  { name: "Administración", key: "admin", role: "ADMIN" },
  { name: "Fisioterapia", key: "fisio", role: "PHYSIO" },
  { name: "Entrenamiento", key: "entrenador", role: "COACH" },
  { name: "Deportista A", key: "deportista-a", role: "ATHLETE" },
  { name: "Deportista B", key: "deportista-b", role: "ATHLETE" },
] as const satisfies readonly { name: string; key: string; role: Role }[];

class SeedError extends Error {}

function target() {
  if (!process.stdin.isTTY || !process.stdout.isTTY || process.env.CI || process.env.RENDER) {
    throw new SeedError("Ejecuta el aprovisionamiento desde una terminal privada.");
  }
  const raw = process.env.PRESENTATION_DIRECT_URL;
  if (!raw) throw new SeedError("Falta PRESENTATION_DIRECT_URL.");
  const url = new URL(raw);
  const neon = url.protocol === "postgresql:" && url.hostname.endsWith(".neon.tech") &&
    !url.hostname.includes("-pooler.") && url.pathname === "/luchasegura_presentacion" &&
    ["require", "verify-full"].includes(url.searchParams.get("sslmode") ?? "");
  const temporary = url.protocol === "postgresql:" && process.env.PRESENTATION_TEMPORARY_TEST === "1" &&
    url.hostname === "127.0.0.1" && url.pathname === "/luchasegura_presentation_test";
  if (!neon && !temporary) throw new SeedError("Se requiere la conexión directa TLS a la base exclusiva de presentación.");
  return { raw, temporary };
}

function privatePasswords(temporary: boolean): string[] {
  const path = temporary ? process.env.PRESENTATION_TEST_CREDENTIALS : join(homedir(), ".luchasegura-presentacion.json");
  if (!path || !isAbsolute(path) || resolve(path).startsWith(resolve("..") + "/")) {
    throw new SeedError("El archivo privado debe quedar fuera del repositorio.");
  }
  try {
    const passwords = accounts.map(({ key }) => ({
      email: key + "@luchasegura.example.test",
      password: "Aa1-" + randomBytes(24).toString("base64url"),
    }));
    writeFileSync(path, JSON.stringify(passwords, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const stat = lstatSync(path);
  if (!stat.isFile() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()) {
    throw new SeedError("El archivo de credenciales debe pertenecer al usuario actual y tener permisos 600.");
  }
  const entries: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(entries) || entries.length !== accounts.length || entries.some((entry, i) =>
    entry?.email !== accounts[i].key + "@luchasegura.example.test" ||
    typeof entry.password !== "string" || !/^Aa1-[\w-]{32}$/.test(entry.password)
  ) || new Set(entries.map(entry => entry.password)).size !== accounts.length) {
    throw new SeedError("El archivo privado de credenciales tiene un formato inválido.");
  }
  return entries.map(entry => entry.password);
}

async function seed(tx: Prisma.TransactionClient, hashes: string[]) {
  const today = calendarDay(new Date());
  const [, physio, coach, owner, active] = await Promise.all(accounts.map(({ name, key, role }, index) =>
    tx.user.create({ data: {
      email: key + "@luchasegura.example.test", fullName: name + " · Simulación", role, passwordHash: hashes[index],
    } }),
  ));
  const exercises = await tx.exercise.findMany({
    where: { isBase: true, archived: false }, orderBy: [{ component: "asc" }, { name: "asc" }, { id: "asc" }], take: 3,
  });
  if (exercises.length !== 3) throw new SeedError("El catálogo base no está disponible.");
  const program = await tx.program.create({ data: {
    id: programId, name: "Programa preventivo · Simulación académica", weeks: 8, sessionsPerWeek: 3,
    sessions: { create: Array.from({ length: 24 }, (_, index) => ({
      week: Math.floor(index / 3) + 1, number: index % 3 + 1, minutes: 25,
      exercises: { create: exercises.map(({ id }, position) => ({ exerciseId: id, position: position + 1 })) },
    })) },
  }, include: { sessions: true } });
  await tx.alertRule.create({ data: { minIntensity: 5, createdById: physio.id } });

  for (const { user, elapsed, finished, category, weight } of [
    { user: owner, elapsed: 63, finished: true, category: "65 kg", weight: 64.5 },
    { user: active, elapsed: 9, finished: false, category: "57 kg", weight: 56.5 },
  ]) {
    const start = shiftDay(today, -elapsed);
    const day = (offset: number) => new Date(shiftDay(start, offset));
    const event = (offset: number) => new Date(shiftDay(start, offset) + "T15:00:00Z");
    const author = { authorId: physio.id, authorName: physio.fullName };
    const athlete = await tx.athlete.create({ data: {
      userId: user.id, coachId: coach.id, programStartedAt: day(0), birthDate: day(-22 * 365 - 10),
      category, weightKg: weight, style: "libre", yearsExperience: finished ? 4 : 2, notes: "Perfil deportivo ficticio.",
    } });
    await tx.completedSession.createMany({ data: program.sessions.filter(session =>
      session.week <= (finished ? 8 : 2) && session.number <= (finished ? 2 : session.week === 1 ? 2 : 1)
    ).map(session => ({
      athleteId: athlete.id, sessionId: session.id,
      doneAt: event((session.week - 1) * 7 + (session.number - 1) * 2),
    })) });
    await tx.injury.create({ data: {
      athleteId: athlete.id, isHistory: true, bodyZone: "Hombro", recurrent: false, daysAbsent: 4,
      historyDate: day(-35), occurredAt: event(-35), notes: "Antecedente simulado.",
    } });
    await tx.injury.create({ data: {
      athleteId: athlete.id, bodyZone: "Rodilla", intensity: 5, limitation: "PARTIAL",
      occurredAt: event(5), createdAt: event(5), notes: "Molestia simulada durante un entrenamiento.",
      alerts: { create: { status: "FOLLOW_UP_PENDING", version: 1, createdAt: event(5), entries: { create: {
        ...author, requestId: randomUUID(), version: 1, kind: "REVIEW", previousStatus: "NEW",
        status: "FOLLOW_UP_PENDING", createdAt: event(6), observations: "Valoración ficticia.",
        actionTaken: "Se documentó el caso simulado.", followUpRequired: true, followUpDate: day(12),
      } } } },
    } });
    for (const [offset, sleepTenths, fatigue, recovery] of [
      [3, 80, "MILD", "GOOD"], [5, 65, "MODERATE", "FAIR"], [8, 75, "MILD", "GOOD"],
    ] as const) {
      await tx.wellbeingEntry.create({ data: {
        athleteId: athlete.id, programId, startedOn: day(0), day: day(offset), week: Math.floor(offset / 7) + 1,
        revisions: { create: { operationId: randomUUID(), version: 1, sleepTenths, fatigue, recovery,
          fingerprint: "simulacion", notes: "Registro simulado." } },
      } });
    }
    async function evaluation(phase: TestPhase, testType: string, result: Prisma.InputJsonObject) {
      const measuredOn = day(phase === "INITIAL" ? -1 : 57);
      await tx.functionalTest.create({ data: {
        athleteId: athlete.id, programId, interventionStartedAt: day(0), testType, phase,
        measuredAt: measuredOn, version: 1, result,
        revisions: { create: { ...author, operationId: randomUUID(), version: 1, measuredOn, result, fingerprint: "simulacion" } },
      } });
    }
    await evaluation("INITIAL", "BASELINE", { baseline: { version: "WEEK0-V1", age: 22, weight, category,
      experience: finished ? 4 : 2, style: "libre", historyReviewed: true }, complete: true });
    for (const phase of (finished ? ["INITIAL", "FINAL"] : ["INITIAL"]) as TestPhase[]) {
      const final = phase === "FINAL";
      const protocol = "SIM-ACADEMICA";
      await evaluation(phase, "T_TEST", { protocol, measurements: [{ value: final ? 11.8 : 12.5, unit: "s" }] });
      for (const [instrument, directions] of [
        ["SEBT", ["Anterior", "Anteromedial", "Medial", "Posteromedial", "Posterior", "Posterolateral", "Lateral", "Anterolateral"]],
        ["YBT", ["Anterior", "Posteromedial", "Posterolateral"]],
      ] as const) {
        await evaluation(phase, instrument, { protocol, measurements: ["LEFT", "RIGHT"].flatMap((side, leg) =>
          directions.map((direction, index) => ({ side, direction, unit: "cm", value: 64 + index * 2 + leg + (final ? 2 : 0) }))) });
      }
      const fms = scoreAssessment("FMS", { version: fmsProtocol, patterns: fmsPatterns.map(({ sides, clearing }, index) => ({
        scores: Array<number>(sides).fill(final && index < 3 ? 3 : 2), clearing: Array<boolean>(clearing).fill(false),
      })) });
      const less = scoreAssessment("LESS", { version: lessProtocol, trials: Array.from({ length: 3 }, (_, attempt) =>
        Array.from({ length: 17 }, (_, item) => Number(item < (final ? 2 : 4) + attempt))) });
      if (!fms?.complete || !less?.complete) throw new SeedError("La evaluación simulada es incompleta.");
      await evaluation(phase, "FMS", { ...fms, protocol });
      await evaluation(phase, "LESS", { ...less, protocol });
    }
  }
  console.log("Carga de presentación completada.");
}

async function main() {
  const { raw, temporary } = target();
  process.env.DATABASE_URL = raw;
  if (temporary) {
    const [server] = await prisma.$queryRaw<{ directory: string }[]>`SELECT current_setting('data_directory') AS directory`;
    if (!/^\/tmp\/luchasegura-presentation-test-[^/]+\/data$/.test(server?.directory ?? "")) {
      throw new SeedError("La instancia PostgreSQL temporal no coincide con el directorio de pruebas.");
    }
  }
  const migration = spawnSync("./node_modules/.bin/prisma", ["migrate", "deploy"], { stdio: "ignore" });
  if (migration.status !== 0) throw new SeedError("Falló prisma migrate deploy. Revisa TLS, permisos y estado de las migraciones en privado.");

  const initialized = await prisma.program.findUnique({ where: { id: programId }, select: { id: true } });
  if (initialized) {
    console.log("La presentación ya está cargada. Se conservaron los datos y las contraseñas actuales.");
    return;
  }
  if (await prisma.user.count() || await prisma.program.count()) {
    throw new SeedError("La primera carga exige una base exclusiva sin usuarios ni programas.");
  }
  const hashes = await Promise.all(privatePasswords(temporary).map(password => bcrypt.hash(password, 12)));
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(64701238)`;
    if (await tx.program.findUnique({ where: { id: programId }, select: { id: true } })) return;
    if (await tx.user.count() || await tx.program.count()) throw new SeedError("La base ya contiene usuarios o programas.");
    await seed(tx, hashes);
  }, { timeout: 30000 });
}

main().catch(error => {
  console.error(error instanceof SeedError ? error.message : "No se pudo cargar la presentación. Revisa el entorno y la conexión en privado.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
