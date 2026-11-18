import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { spawnSync } from "node:child_process";
import type { Server } from "node:http";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { config } from "../src/config";
import { prisma } from "../src/db";
import { apiErrorHandler } from "../src/middleware/api-error";

if (process.env.ALERT_REVIEW_TESTS !== "1" || !process.env.DATABASE_URL?.includes("/luchasegura_alert_test")) {
  throw new Error("Las regresiones requieren PostgreSQL temporal");
}

let server: Server;
let base: string;
const password = "Fase5-sintetica-2026";
let passwordHash: string;

async function start(application: express.Express) {
  const running = application.listen(0, "127.0.0.1");
  await once(running, "listening");
  return { running, url: `http://127.0.0.1:${(running.address() as { port: number }).port}` };
}
const stop = (running: Server) => new Promise<void>(resolve => running.close(() => resolve()));

before(async () => {
  passwordHash = await bcrypt.hash(password, 4);
  const { running, url } = await start(app);
  server = running;
  base = url + "/api";
});
after(async () => {
  if (server) await stop(server);
  await prisma.$disconnect();
});

async function account(role: "ATHLETE" | "PHYSIO" | "COACH" = "ATHLETE") {
  return prisma.user.create({ data: { fullName: "Cuenta sintética de seguridad",
    email: randomUUID() + "@example.test", role, passwordHash } });
}

function call(path: string, method: string = "GET", body?: unknown, token?: string, headers?: Record<string, string>) {
  return fetch(base + path, {
    method, headers: { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function login(email: string, supplied = password) {
  return call("/auth/login", "POST", { email, password: supplied });
}
function bearer(user: { id: string; role: string }) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: "5m" });
}
async function issueFixtureLink(userId: string) {
  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({ data: {
    userId, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60000),
  } });
  return token;
}

test("Login uniforme, cuentas desactivadas y respuestas privadas sin caché", async () => {
  const user = await account();
  const invalid = await login(user.email, "incorrecta");
  const missing = await login(randomUUID() + "@example.test");
  assert.equal(invalid.status, 401);
  assert.equal(missing.status, 401);
  assert.deepEqual(await invalid.json(), await missing.json());

  const success = await login(user.email);
  assert.equal(success.status, 200);
  assert.match(success.headers.get("cache-control")!, /no-store/);
  assert.equal(success.headers.get("x-powered-by"), null);
  assert.equal(success.headers.get("x-content-type-options"), "nosniff");
  const { token, user: publicUser } = await success.json() as { token: string; user: Record<string, unknown> };
  assert.equal(publicUser.passwordHash, undefined);
  const profile = await call("/auth/me", "GET", undefined, token);
  assert.equal(profile.status, 200);
  assert.match(profile.headers.get("cache-control")!, /no-store/);
  assert.equal((await profile.json() as Record<string, unknown>).passwordHash, undefined);
  await prisma.user.update({ where: { id: user.id }, data: { active: false } });
  assert.equal((await call("/auth/me", "GET", undefined, token)).status, 401);
  assert.equal((await login(user.email)).status, 401);
});

test("Cambios concurrentes de contraseña rechazan escrituras obsoletas y revocan JWT anteriores", async () => {
  const user = await account();
  const old = await (await login(user.email)).json() as { token: string };
  const extra = await issueFixtureLink(user.id);
  const change = () => call("/auth/change-password", "POST", {
    currentPassword: password, newPassword: "Fase5-cambiada-2026",
  }, old.token);
  const results = await Promise.all([change(), change()]);
  const winners = results.filter(response => response.status === 200);
  assert.equal(winners.length, 1);
  assert.ok(results.some(response => [400, 401, 409].includes(response.status)));
  const { token } = await winners[0].json() as { token: string };
  assert.equal((await call("/auth/me", "GET", undefined, old.token)).status, 401);
  assert.equal((await call("/auth/me", "GET", undefined, token)).status, 200);
  const oldVersion = (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passwordChangedAt!;
  const previousSession = jwt.sign({ sub: user.id, role: user.role, iat: Math.floor(+oldVersion / 1000) },
    config.jwtSecret, { expiresIn: "5m" });
  assert.equal((await call("/auth/me", "GET", undefined, previousSession)).status, 401);
  assert.deepEqual(await (await call("/auth/reset-password/check?token=" + extra)).json(), { valid: false });
  const long = await call("/auth/change-password", "POST", {
    currentPassword: "Fase5-cambiada-2026", newPassword: "Muestra-1-" + "ñ".repeat(40),
  }, token);
  assert.equal(long.status, 400);
});

test("El restablecimiento consume el enlace una sola vez y no lo ofrece sin canal de entrega", async () => {
  const user = await account();
  const old = await (await login(user.email)).json() as { token: string };
  const fixture = await issueFixtureLink(user.id);
  const attempts = ["Fase5-restablecida-1", "Fase5-restablecida-2"];
  const results = await Promise.all(attempts.map(next => call("/auth/reset-password", "POST", { token: fixture, password: next })));
  assert.deepEqual(results.map(response => response.status).sort(), [200, 400]);
  const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(await bcrypt.compare(attempts[results.findIndex(r => r.status === 200)], updated.passwordHash), true);
  assert.equal((await call("/auth/me", "GET", undefined, old.token)).status, 401);
  assert.deepEqual(await (await call("/auth/reset-password/check?token=" + fixture)).json(), { valid: false });

  const before = await prisma.passwordResetToken.count({ where: { userId: user.id } });
  const unavailable = await call("/auth/forgot-password", "POST", { email: user.email });
  const notFound = await call("/auth/forgot-password", "POST", { email: randomUUID() + "@example.test" });
  assert.equal(unavailable.status, 503);
  assert.equal(notFound.status, 503);
  assert.deepEqual(await unavailable.json(), await notFound.json());
  assert.equal(await prisma.passwordResetToken.count({ where: { userId: user.id } }), before);
});

test("Alcance por propietario y entrenador, sin filtración de notas ni evaluaciones", async () => {
  const [first, second, coach] = await Promise.all([account(), account(), account("COACH")]);
  const own = await prisma.athlete.create({ data: { userId: first.id, coachId: coach.id, notes: "Dato privado sintético" } });
  const other = await prisma.athlete.create({ data: { userId: second.id } });
  const injury = await prisma.injury.create({ data: { athleteId: other.id, bodyZone: "Hombro" } });
  assert.equal((await call("/injuries/" + injury.id, "DELETE", undefined, bearer(first))).status, 404);
  assert.equal((await prisma.injury.count({ where: { id: injury.id } })), 1);
  const list = await (await call("/injuries/mine", "GET", undefined, bearer(first))).json() as { id: string }[];
  assert.ok(!list.some(row => row.id === injury.id));
  assert.equal((await call("/team/athletes/" + other.id, "GET", undefined, bearer(coach))).status, 404);
  assert.equal((await call("/exercises/athlete/" + other.id, "GET", undefined, bearer(coach))).status, 404);
  assert.equal((await call("/team/athletes/" + own.id + "/evaluations", "GET", undefined, bearer(coach))).status, 403);
  assert.equal((await call("/team/export?athleteId=" + own.id, "GET", undefined, bearer(coach))).status, 403);
  const detail = await (await call("/team/athletes/" + own.id, "GET", undefined, bearer(coach))).json() as { profile: { notes: unknown } };
  assert.equal(detail.profile.notes, null);
});

test("Inicio y registro de sesión no pueden persistir un estado contradictorio", async () => {
  const program = await prisma.program.findFirstOrThrow({ where: { sessions: { some: {} } }, orderBy: { id: "asc" },
    include: { sessions: { orderBy: { week: "asc" } } } });
  const session = program.sessions[0];
  const physio = await account("PHYSIO");
  const tomorrow = new Date(Date.now() + 48 * 3600000).toISOString().slice(0, 10);
  for (let i = 0; i < 3; i++) {
    const user = await account();
    const athlete = await prisma.athlete.create({ data: { userId: user.id, programStartedAt: new Date("2025-11-01") } });
    const [startDate, completion] = await Promise.all([
      call("/team/athletes/" + athlete.id + "/program-start", "PATCH",
        { startedAt: tomorrow, expectedStartedAt: "2025-11-01" }, bearer(physio)),
      call("/program/sessions/" + session.id + "/toggle", "POST", { done: true }, bearer(user))
    ]);
    assert.ok([200, 400, 409].includes(startDate.status));
    assert.ok([200, 400, 409].includes(completion.status));
    assert.ok(startDate.status === 200 || completion.status === 200);
    const stored = await prisma.athlete.findUniqueOrThrow({ where: { id: athlete.id }, include: { completed: true } });
    assert.ok(stored.completed.length === 0 || stored.programStartedAt!.toISOString().slice(0, 10) < tomorrow);
  }
});

test("Validación de fechas, tamaño de entrada, CORS y respuesta 500 sin información interna", async t => {
  const invalidDate = await call("/auth/register", "POST", { email: "sintetico@example.test",
    password, fullName: "Registro sintético", birthDate: "2026-02-30", consent: { textVersion: "fixture" } });
  assert.equal(invalidDate.status, 400);
  const malformed = await fetch(base + "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.match(malformed.headers.get("cache-control")!, /no-store/);
  const oversized = await call("/auth/login", "POST", { email: "x".repeat(105000), password });
  assert.equal(oversized.status, 413);

  const approved = await call("/health", "GET", undefined, undefined, { Origin: config.corsOrigin });
  const unapproved = await call("/health", "GET", undefined, undefined, { Origin: "http://unlisted.example.test" });
  assert.equal(approved.headers.get("access-control-allow-origin"), config.corsOrigin);
  assert.equal(unapproved.headers.get("access-control-allow-origin"), null);

  const synthetic = express();
  const marker = "CAMPO_PRIVADO_SINTETICO";
  const log = t.mock.method(console, "error", () => {});
  synthetic.get("/error-sintetico", () => { throw new Error(marker); });
  synthetic.use(apiErrorHandler);
  const { running, url } = await start(synthetic);
  try {
    const response = await fetch(url + "/error-sintetico");
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "Error interno del servidor" });
    assert.equal(log.mock.callCount(), 1);
    assert.ok(!JSON.stringify(log.mock.calls.map(c => c.arguments)).includes(marker));
  } finally { await stop(running); }
});

test("El comando de inicialización crea un administrador con cambio obligatorio", async () => {
  const email = "primera-cuenta-sintetica@example.test";
  const result = spawnSync("npm", ["run", "db:create-admin", "--", email, "Administrador sintético"], {
    encoding: "utf8", timeout: 30000,
  });
  assert.equal(result.status, 0, "No se pudo ejecutar la inicialización");
  const temporary = result.stdout.match(/Contraseña temporal \(se muestra una sola vez\): (.+)/)?.[1]?.trim();
  if (!temporary) assert.fail("La inicialización no entregó una contraseña temporal");
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  assert.equal(user.role, "ADMIN");
  assert.equal(user.mustChangePassword, true);
  assert.equal(await bcrypt.compare(temporary, user.passwordHash), true);
  const signed = await login(email, temporary);
  assert.equal(signed.status, 200);
  const { token } = await signed.json() as { token: string };
  assert.equal((await call("/admin/users", "GET", undefined, token)).status, 403);
});

test("El limitador de acceso devuelve 429 con tiempo de espera", async () => {
  let limited: Response | undefined;
  for (let attempt = 0; attempt < 11; attempt++) {
    const response = await call("/auth/login", "POST", {});
    if (response.status === 429) { limited = response; break; }
    assert.equal(response.status, 400);
    await response.arrayBuffer();
  }
  assert.ok(limited);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
  assert.ok((await limited.json() as { retryAfter: number }).retryAfter > 0);
});
