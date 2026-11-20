import { assertIsolatedDatabase, assertIsolatedEnvironment } from './isolated-database';
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { spawn, spawnSync } from "node:child_process";
import type { Server } from "node:http";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { config } from "../src/config";
import { prisma } from "../src/db";
import { apiErrorHandler } from "../src/middleware/api-error";

assertIsolatedEnvironment();

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
  await assertIsolatedDatabase(prisma);
  passwordHash = await bcrypt.hash(password, 4);
  const { running, url } = await start(app);
  server = running;
  base = url + "/api";
});
after(async () => {
  if (server) await stop(server);
  await prisma.$disconnect();
});

async function account(role: "ATHLETE" | "PHYSIO" | "COACH" | "ADMIN" = "ATHLETE") {
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

test("Cerrar sesión revoca solo ese JWT, de forma persistente e idempotente", async () => {
  const user = await account("ADMIN");
  const responses = await Promise.all([login(user.email), login(user.email)]);
  assert.deepEqual(responses.map(response => response.status), [200, 200]);
  const [{ token: first }, { token: second }] = await Promise.all(
    responses.map(response => response.json() as Promise<{ token: string }>),
  );
  assert.notEqual(first, second);
  assert.equal((await call("/admin/users", "GET", undefined, first)).status, 200);

  const expired = jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: -1 });
  assert.equal((await call("/auth/logout", "POST", undefined, expired)).status, 401);
  assert.equal((await call("/auth/logout", "POST", undefined, first + "a")).status, 401);
  const results = await Promise.all([1, 2].map(() => call("/auth/logout", "POST", undefined, first)));
  assert.deepEqual(results.map(response => response.status), [204, 204]);
  assert.equal((await call("/admin/users", "GET", undefined, first)).status, 401);
  assert.equal((await call("/admin/users", "GET", undefined, second)).status, 200);
  assert.equal(await prisma.revokedSession.count({ where: {
    digest: createHash("sha256").update(first).digest("hex"),
  } }), 1);

  const restarted = spawn(process.execPath, ["--import", "tsx", "-e", `
    const { app } = require("./src/app");
    const server = app.listen(0, "127.0.0.1", () => process.send(server.address().port));
  `], { stdio: ["ignore", "ignore", "inherit", "ipc"] });
  const stopped = once(restarted, "exit");
  try {
    const [port] = await once(restarted, "message", { signal: AbortSignal.timeout(15_000) });
    assert.equal(typeof port, "number");
    const afterRestart = (path: string, token: string, method = "GET") =>
      fetch(`http://127.0.0.1:${port}/api${path}`, {
        method, headers: { Authorization: "Bearer " + token }, signal: AbortSignal.timeout(5_000),
      });
    assert.equal((await afterRestart("/auth/me", first)).status, 401);
    assert.equal((await afterRestart("/auth/me", second)).status, 200);
    assert.equal((await afterRestart("/auth/logout", first, "POST")).status, 204);
  } finally {
    restarted.kill();
    await stopped;
  }
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
  assert.deepEqual(await (await call("/auth/reset-password/check", "POST", { token: extra })).json(), { valid: false });
  const long = await call("/auth/change-password", "POST", {
    currentPassword: "Fase5-cambiada-2026", newPassword: "Muestra-1-" + "ñ".repeat(40),
  }, token);
  assert.equal(long.status, 400);
});

test("El restablecimiento consume el enlace una sola vez y no lo ofrece sin canal de entrega", async () => {
  const user = await account();
  const old = await (await login(user.email)).json() as { token: string };
  const fixture = await issueFixtureLink(user.id);
  assert.equal((await call("/auth/reset-password/check")).status, 404);
  const attempts = ["Fase5-restablecida-1", "Fase5-restablecida-2"];
  const results = await Promise.all(attempts.map(next => call("/auth/reset-password", "POST", { token: fixture, password: next })));
  assert.deepEqual(results.map(response => response.status).sort(), [200, 400]);
  const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(await bcrypt.compare(attempts[results.findIndex(r => r.status === 200)], updated.passwordHash), true);
  assert.equal((await call("/auth/me", "GET", undefined, old.token)).status, 401);
  assert.deepEqual(await (await call("/auth/reset-password/check", "POST", { token: fixture })).json(), { valid: false });

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
    password, fullName: "Registro sintético", birthDate: "2026-02-30", consent: { textVersion: "v0.2-borrador", accepted: true } });
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

test("Reactivar una cuenta no restaura sesiones o enlaces anteriores", async () => {
  const admin = await account("ADMIN");
  const user = await account("COACH");
  const loginToken = async (email: string) => (await (await login(email)).json() as { token: string }).token;
  const adminToken = await loginToken(admin.email);
  const old = await loginToken(user.email);
  const fixture = await issueFixtureLink(user.id);
  const amend = (body: unknown) => call("/admin/users/" + user.id, "PATCH", body, adminToken);
  assert.equal((await amend({ fullName: "Entrenador actualizado" })).status, 200);
  assert.equal((await call("/auth/me", "GET", undefined, old)).status, 200);
  assert.equal((await amend({ active: false })).status, 200);
  assert.equal((await amend({ active: true })).status, 200);
  assert.equal((await call("/auth/me", "GET", undefined, old)).status, 401);
  assert.deepEqual(await (await call("/auth/reset-password/check", "POST", { token: fixture })).json(), { valid: false });
  const current = await loginToken(user.email);
  assert.equal((await call("/auth/me", "GET", undefined, current)).status, 200);
});

test("Cambiar correo o rol invalida las sesiones anteriores de la cuenta", async () => {
  const admin = bearer(await account("ADMIN"));
  const user = await account("COACH");
  const issue = async (email: string) => {
    const response = await login(email);
    assert.equal(response.status, 200);
    return (await response.json() as { token: string }).token;
  };
  const oldSessions = await Promise.all([issue(user.email), issue(user.email)]);
  const email = randomUUID() + "@example.test";
  const edit = (body: unknown) => call("/admin/users/" + user.id, "PATCH", body, admin);
  assert.equal((await edit({ email })).status, 200);
  for (const token of oldSessions) {
    assert.equal((await call("/auth/me", "GET", undefined, token)).status, 401);
  }
  const coach = await issue(email);
  assert.equal((await edit({ role: "PHYSIO" })).status, 200);
  assert.equal((await call("/auth/me", "GET", undefined, coach)).status, 403);
  const physio = await issue(email);
  assert.equal((await call("/team/alerts/counts", "GET", undefined, physio)).status, 200);
});

test("Las rutas protegidas comprueban sesión y rol antes de consultar o mutar", async () => {
  const roles = ["ADMIN", "PHYSIO", "ATHLETE", "COACH"] as const;
  const tokens = await Promise.all(roles.map(async role => bearer(await account(role))));
  const id = randomUUID();
  const routes = [
    ["ADMIN", "GET", "/admin/users"], ["ADMIN", "POST", "/admin/users"],
    ["ADMIN", "PATCH", `/admin/users/${id}`], ["ADMIN", "DELETE", `/admin/users/${id}`],
    ["ADMIN", "PATCH", `/admin/athletes/${id}/coach`],
    ["PHYSIO", "GET", "/team/alerts"], ["PHYSIO", "GET", "/team/alerts/counts"],
    ["PHYSIO", "GET", `/team/alerts/${id}`], ["PHYSIO", "POST", `/team/alerts/${id}/review`],
    ["PHYSIO", "GET", `/team/athletes/${id}/evaluations`],
    ["PHYSIO", "PATCH", `/team/athletes/${id}/program-start`], ["PHYSIO", "GET", "/team/export"],
    ["PHYSIO", "POST", "/exercises"], ["PHYSIO", "PATCH", `/exercises/${id}`],
    ["PHYSIO", "DELETE", `/exercises/${id}`], ["PHYSIO", "POST", "/exercises/assignments"],
    ["PHYSIO", "DELETE", `/exercises/assignments/${id}`],
    ["PHYSIO", "POST", "/rules"], ["PHYSIO", "DELETE", `/rules/${id}`],
    ["ATHLETE", "GET", "/athletes/me"], ["ATHLETE", "PUT", "/athletes/me"],
    ["ATHLETE", "POST", "/injuries"], ["ATHLETE", "GET", "/injuries/mine"],
    ["ATHLETE", "PATCH", `/injuries/${id}/history`], ["ATHLETE", "DELETE", `/injuries/${id}`],
    ["ATHLETE", "GET", "/program/current"], ["ATHLETE", "POST", `/program/sessions/${id}/toggle`],
    ["ATHLETE", "GET", "/exercises/mine"],
    ["TEAM", "GET", "/athletes"], ["TEAM", "GET", "/team/overview"],
    ["TEAM", "GET", `/team/athletes/${id}`], ["TEAM", "GET", `/exercises/athlete/${id}`],
    ["TEAM", "GET", "/exercises"], ["TEAM", "GET", "/rules"],
    ["ALL", "GET", "/auth/me"], ["ALL", "POST", "/auth/change-password"],
  ] as const;

  const revoked = bearer(await account("ADMIN"));
  assert.equal((await call("/auth/logout", "POST", undefined, revoked)).status, 204);
  for (const [access, method, path] of routes) {
    const label = `${method} ${path}`;
    assert.equal((await call(path, method)).status, 401, label);
    assert.equal((await call(path, method, undefined, revoked)).status, 401, label);
    for (const [index, role] of roles.entries()) {
      if (access === "ALL" || access === role ||
          (access === "TEAM" && (role === "COACH" || role === "PHYSIO"))) continue;
      assert.equal((await call(path, method, undefined, tokens[index])).status, 403, `${label} · ${role}`);
    }
  }
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
