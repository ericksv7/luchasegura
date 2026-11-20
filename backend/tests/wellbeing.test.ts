import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { config } from "../src/config";
import { prisma } from "../src/db";
import { consentEvidence } from "../src/services/consent";
import { assertIsolatedDatabase } from "./isolated-database";

const own = "/athletes/me/wellbeing";
const programId = "0000-wellbeing";
const firstStart = "2025-01-06";
const intervention = { programId, startedOn: firstStart };
const users = new Map<string, { id: string; role: Role }>();
let ownerId: string;
let server: ReturnType<typeof app.listen>;
let origin: string;

before(async () => {
  await assertIsolatedDatabase(prisma);
  for (const [name, role] of [
    ["owner", "ATHLETE"], ["other", "ATHLETE"], ["physio", "PHYSIO"], ["unassigned", "PHYSIO"],
    ["coach", "COACH"], ["admin", "ADMIN"],
  ] as const) {
    const user = await prisma.user.create({
      data: { fullName: name, email: `${name}-wellbeing@example.test`, passwordHash: "fixture", role },
    });
    users.set(name, user);
  }
  const owner = await prisma.athlete.create({ data: {
    userId: users.get("owner")!.id, coachId: users.get("coach")!.id, programStartedAt: new Date(firstStart),
  } });
  ownerId = owner.id;
  await prisma.athlete.create({ data: { userId: users.get("other")!.id } });
  await prisma.program.create({ data: {
    id: programId, name: "Programa bienestar sintético", weeks: 8, sessions: { create: { week: 1, number: 1 } },
  } });
  const professional = users.get("physio")!;
  await prisma.functionalTest.create({ data: {
    athleteId: ownerId, testType: "T_TEST", phase: "INITIAL", result: {}, version: 1,
    revisions: { create: {
      operationId: randomUUID(), version: 1, authorId: professional.id, authorName: "Fisioterapia sintética",
      measuredOn: new Date(firstStart), result: {}, fingerprint: "fixture",
    } },
  } });
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(async () => {
  if (server) await new Promise<void>(done => server.close(() => done()));
  await prisma.$disconnect();
});

function token(name: string) {
  const user = users.get(name)!;
  return jwt.sign({ sub: user.id, role: user.role, jti: randomUUID() }, config.jwtSecret, { expiresIn: "1h" });
}
async function call(method: string, path: string, name = "owner", body?: unknown, credential?: string, target = origin) {
  const response = await fetch(target + "/api" + path, {
    method, signal: AbortSignal.timeout(5000),
    headers: { "Content-Type": "application/json", ...(name ? { Authorization: "Bearer " + (credential ?? token(name)) } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, data: response.status === 204 ? null : await response.json() };
}
const entry = (day = firstStart) => ({ day, intervention, operationId: randomUUID(), sleepHours: 7.5, fatigue: "NONE", notes: "Nota privada sintética" });

test("valida ventana de la intervención, datos incompletos y diario civil de Bogotá", async t => {
  for (const override of [
    { day: "2025-02-30" }, { day: "2025-01-05" }, { day: "2025-03-03" }, { day: "9999-01-01" },
    { sleepHours: 24.1 }, { sleepHours: -1 }, { sleepHours: 1.01 }, { fatigue: "SEVERE" },
    { notes: " x ".repeat(501) }, { fatigue: null, sleepHours: null }, { athleteId: ownerId },
  ]) assert.equal((await call("POST", own, "owner", { ...entry(), ...override })).status, 400);

  const other = await call("GET", own, "other");
  assert.equal(other.data.intervention, null);
  assert.equal((await call("POST", own, "other", entry())).status, 409);
  const midnight = entry("2025-01-07");
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2025-01-07T04:59:59Z") });
  try {
    assert.equal((await call("POST", own, "owner", midnight)).status, 400);
    t.mock.timers.tick(1000);
    const saved = await call("POST", own, "owner", midnight);
    assert.equal(saved.status, 201);
    const found = (await call("GET", own + "/" + saved.data.id)).data;
    assert.equal(found.day, midnight.day);
    assert.equal(found.week, 1);
    assert.equal(found.current.sleepHours, 7.5);
    assert.equal(found.current.fatigue, "NONE");
    assert.equal(found.current.rest, null);
  } finally { t.mock.timers.reset(); }
  const optional = { ...entry("2025-01-08"), sleepHours: null, fatigue: null, recovery: "LOW" };
  assert.equal((await call("POST", own, "owner", optional)).status, 201);
});

test("resuelve reintentos y concurrencia sin sobrescribir versiones; conserva la intervención original", async () => {
  const captured = entry("2025-01-13");
  const same = await Promise.all([0, 1, 2].map(() => call("POST", own, "owner", captured)));
  assert.deepEqual(same.map(row => row.status).sort(), [200, 200, 201]);
  const id = same[0].data.id;
  const path = own + "/" + id;
  const duplicate = await call("POST", own, "owner", { ...captured, operationId: randomUUID() });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.data.code, "EXISTS");
  assert.equal(duplicate.data.id, id);

  const edit = { operationId: randomUUID(), expectedVersion: 1, sleepHours: 0, rest: "FAIR" };
  const identicalEdits = await Promise.all([0, 1].map(() => call("PATCH", path, "owner", edit)));
  assert.ok(identicalEdits.every(result => result.status === 200 && result.data.version === 2));
  const conflict = await Promise.all([6.5, 8].map(sleepHours =>
    call("PATCH", path, "owner", { operationId: randomUUID(), expectedVersion: 2, sleepHours })));
  assert.deepEqual(conflict.map(row => row.status).sort(), [200, 409]);
  assert.equal((await call("PATCH", path, "owner", edit)).data.version, 2);
  const revisions = (await call("GET", path + "/revisions")).data.revisions;
  assert.deepEqual(revisions.map((row: { version: number }) => row.version), [3, 2, 1]);
  assert.equal(revisions[2].notes, captured.notes);
  assert.equal(revisions[1].sleepHours, 0);
  assert.equal(revisions[0].notes, null);
  assert.equal((await call("GET", path + "/revisions?before=3")).data.revisions.length, 2);

  await prisma.athlete.update({ where: { id: ownerId }, data: { programStartedAt: new Date("2025-02-01") } });
  try {
    assert.equal((await call("POST", own, "owner", entry("2025-01-15"))).status, 409);
    const record = (await call("GET", path)).data;
    assert.equal(record.startedOn, firstStart);
    assert.equal(record.program.id, programId);
    assert.equal(record.week, 2);
    assert.equal((await call("PATCH", path, "owner", { ...edit, operationId: randomUUID(), expectedVersion: 3 })).status, 200);
  } finally {
    await prisma.athlete.update({ where: { id: ownerId }, data: { programStartedAt: new Date(firstStart) } });
  }
});

test("protege propiedad, notas, alcance profesional y revocación de sesión", async () => {
  const path = `/team/athletes/${ownerId}/wellbeing`;
  const id = (await call("GET", own)).data.entries[0].id;
  for (const role of ["coach", "admin", "physio", ""]) {
    assert.equal((await call("GET", own, role)).status, role ? 403 : 401);
  }
  for (const role of ["coach", "admin", "unassigned", "other", ""]) {
    assert.equal((await call("GET", path, role)).status, role ? 403 : 401);
  }
  for (const endpoint of [own + "/" + id, own + "/" + id + "/revisions", own + "?cursor=" + id]) {
    assert.equal((await call("GET", endpoint, "other")).status, 404);
  }
  assert.equal((await call("PATCH", own + "/" + id, "other", { operationId: randomUUID(), expectedVersion: 1, sleepHours: 7 })).status, 404);
  const clinician = await call("GET", path, "physio");
  assert.equal(clinician.status, 200);
  assert.ok(clinician.data.entries.length);
  assert.ok(clinician.data.entries.every((row: { current: object }) => !("notes" in row.current)));
  assert.equal((await call("POST", path, "physio", entry())).status, 404);
  assert.equal((await call("GET", own + "?cursor=invalid")).status, 400);

  const credential = token("owner");
  assert.equal((await call("GET", own, "owner", undefined, credential)).status, 200);
  assert.equal((await call("POST", "/auth/logout", "owner", undefined, credential)).status, 204);
  assert.equal((await call("GET", own, "owner", undefined, credential)).status, 401);
  assert.equal((await call("POST", own, "owner", entry(), credential)).status, 401);
});

test("pagina sin duplicados y conserva los registros en un proceso nuevo", async () => {
  for (let i = 1; i <= 15; i++) {
    const day = `2025-02-${String(i).padStart(2, "0")}`;
    assert.equal((await call("POST", own, "owner", entry(day))).status, 201);
  }
  const first = (await call("GET", own)).data;
  assert.equal(first.entries.length, 14);
  const next = (await call("GET", own + "?cursor=" + first.nextCursor)).data;
  assert.equal(next.nextCursor, null);
  const ids = [...first.entries, ...next.entries].map(row => row.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(first.entries.at(-1).day > next.entries[0].day);

  const child = spawn(process.execPath, ["--import", "tsx", "-e", `
    const {app} = require('./src/app');
    const server = app.listen(0, '127.0.0.1', () => process.send(server.address().port));
  `], { env: process.env, stdio: ["ignore", "ignore", "inherit", "ipc"] });
  const exited = once(child, "exit");
  try {
    const [port] = await once(child, "message", { signal: AbortSignal.timeout(10000) });
    const reread = await call("GET", own + "/" + ids[0], "owner", undefined, undefined, "http://127.0.0.1:" + port);
    assert.equal(reread.status, 200);
    assert.deepEqual(reread.data, first.entries[0]);
  } finally { child.kill(); await exited; }
});

test("la serie de sueño conserva periodos y devuelve solo horas registradas y sus fechas", async () => {
  const unit = "/athletes/me/sleep";
  const path = `/team/athletes/${ownerId}/sleep`;
  const old = (await call("GET", unit)).data.periods[0];
  assert.equal(old.startedOn, firstStart);
  assert.deepEqual(old.points.find(point => point.day === "2025-01-07"), { day: "2025-01-07", week: 1, hours: 7.5 });
  assert.equal(old.points.some(point => ["2025-01-08", "2025-01-09"].includes(point.day)), false);
  assert.equal(old.points.find(point => point.day === "2025-01-13").hours, 0);
  assert.equal(old.points.every(point => Object.keys(point).sort().join(",") === "day,hours,week"), true);
  assert.equal((await call("GET", unit, "other")).data.periods.length, 0);
  assert.equal((await call("GET", path, "physio")).status, 200);
  assert.equal((await call("GET", path, "unassigned")).status, 403);
  assert.equal((await call("GET", path, "admin")).status, 403);
  assert.equal((await call("GET", path, "coach")).status, 403);

  const later = "2025-03-03";
  await prisma.athlete.update({ where: { id: ownerId }, data: { programStartedAt: new Date(later) } });
  try {
    const created = await call("POST", own, "owner", { ...entry(later), intervention: { programId, startedOn: later } });
    assert.equal(created.status, 201);
    const periods = (await call("GET", unit)).data.periods;
    assert.deepEqual(periods.map(period => period.startedOn), [later, firstStart]);
    const earlier = await call("GET", `${unit}?beforeStart=${later}&beforeProgram=${programId}`);
    assert.deepEqual(earlier.data.periods, [old]);
    assert.equal((await call("GET", unit + "?beforeStart=0000-01-01&beforeProgram=x")).status, 400);
    assert.equal((await call("GET", unit + "?beforeStart=2025-01-21")).status, 400);
  } finally {
    await prisma.athlete.update({ where: { id: ownerId }, data: { programStartedAt: new Date(firstStart) } });
  }
});

test("exige autorización específica del adulto, revoca inmediatamente y nunca restaura un permiso tras reasignar", async () => {
  const sharing = "/athletes/me/sleep/sharing";
  const path = `/team/athletes/${ownerId}/sleep`;
  const coachId = users.get("coach")!.id;
  const userId = users.get("owner")!.id;
  const noticeVersion = (await call("GET", sharing)).data.noticeVersion;
  const grant = { coachId, noticeVersion, accepted: true };
  assert.equal((await call("PUT", sharing, "owner", grant)).status, 403);
  await prisma.athlete.update({ where: { id: ownerId }, data: { birthDate: new Date("1999-07-01") } });
  assert.equal((await call("PUT", sharing, "owner", grant)).status, 403);
  await prisma.consent.create({ data: { userId, ...consentEvidence(false) } });
  await prisma.athlete.update({ where: { id: ownerId }, data: { birthDate: new Date() } });
  assert.equal((await call("PUT", sharing, "owner", grant)).status, 403);
  await prisma.athlete.update({ where: { id: ownerId }, data: { birthDate: new Date("1999-07-01") } });
  assert.equal((await call("PUT", sharing, "owner", { ...grant, accepted: false })).status, 400);
  assert.equal((await call("PUT", sharing, "owner", { ...grant, coachId: randomUUID() })).status, 409);
  assert.equal((await call("GET", path, "coach")).status, 403);
  assert.equal((await call("PUT", sharing, "owner", grant)).status, 204);
  const first = await prisma.sleepSharing.findUniqueOrThrow({ where: { athleteId: ownerId } });
  assert.equal((await call("PUT", sharing, "owner", grant)).status, 204);
  assert.deepEqual(await prisma.sleepSharing.findUnique({ where: { athleteId: ownerId } }), first);

  const coach = await call("GET", path, "coach");
  assert.equal(coach.status, 200);
  assert.deepEqual(coach.data, (await call("GET", "/athletes/me/sleep")).data);
  assert.doesNotMatch(JSON.stringify(coach.data), /notes|fatigue|recovery|revisions|observaciones/i);
  assert.equal((await call("GET", `/team/athletes/${ownerId}/wellbeing`, "coach")).status, 403);
  const other = await prisma.athlete.findUniqueOrThrow({ where: { userId: users.get("other")!.id } });
  assert.equal((await call("GET", `/team/athletes/${other.id}/sleep`, "coach")).status, 404);
  await prisma.athlete.update({ where: { id: other.id }, data: { coachId } });
  assert.equal((await call("GET", `/team/athletes/${other.id}/sleep`, "coach")).status, 403);
  const second = await prisma.user.create({ data: {
    role: "COACH", fullName: "Otro entrenador", email: "another-coach@example.test", passwordHash: "fixture",
  } });
  users.set("coach2", second);
  assert.equal((await call("GET", path, "coach2")).status, 404);

  const wasProd = config.isProd;
  config.isProd = true;
  try {
    assert.equal((await call("GET", path, "coach")).status, 403);
    assert.equal((await call("PUT", sharing, "owner", grant)).status, 403);
  } finally { config.isProd = wasProd; }

  assert.equal((await call("DELETE", sharing)).status, 204);
  assert.equal((await call("GET", path, "coach")).status, 403);
  assert.equal((await call("PUT", sharing, "owner", grant)).status, 204);
  const assignment = `/admin/athletes/${ownerId}/coach`;
  assert.equal((await call("PATCH", assignment, "admin", { coachId: second.id })).status, 200);
  assert.equal((await call("GET", path, "coach")).status, 404);
  assert.equal((await call("GET", path, "coach2")).status, 403);
  assert.equal((await call("PATCH", assignment, "admin", { coachId })).status, 200);
  assert.equal((await call("GET", path, "coach")).status, 403);

  assert.equal((await call("PUT", sharing, "owner", grant)).status, 204);
  assert.equal((await call("PUT", "/athletes/me", "owner", { birthDate: "1999-07-02" })).status, 200);
  assert.equal((await call("GET", path, "coach")).status, 403);
  assert.equal((await call("PUT", "/athletes/me", "owner", { birthDate: "1999-07-01" })).status, 200);
  assert.equal((await call("GET", path, "coach")).status, 403);
});
