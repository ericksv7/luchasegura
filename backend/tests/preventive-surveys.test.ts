import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { after, before, test } from "node:test";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { config } from "../src/config";
import { prisma } from "../src/db";
import { catalogueFor, shiftDay, surveyNotice, validateAnswers, windowFor } from "../src/services/preventive-survey";
import { calendarDay } from "../src/services/program";
import { seedSurveys } from "./preventive-survey-fixture";

let fixture: Awaited<ReturnType<typeof seedSurveys>>;
let server: ReturnType<typeof app.listen>;
let base: string;

before(async () => {
  fixture = await seedSurveys();
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
});
after(async () => {
  if (server) await new Promise<void>(done => server.close(() => done()));
  await prisma.$disconnect();
});

type Actor = "owner" | "other" | "minor" | "physio" | "coach" | "admin" | "unrelated";
function token(actor: Actor) {
  const user = fixture[actor];
  return jwt.sign({ sub: user.id, role: user.role, jti: randomUUID() }, config.jwtSecret, { expiresIn: "1h" });
}
const own = "/preventive-surveys/me";
const team = () => "/preventive-surveys/team/" + fixture.athlete.id;
async function request(method: string, path: string, actor: Actor, body?: unknown, auth = token(actor)) {
  const response = await fetch(base + path, {
    method, signal: AbortSignal.timeout(6000),
    headers: { Authorization: "Bearer " + auth, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, data: response.headers.get("content-type")?.includes("json") ? await response.json() : null };
}
const accept = (actor: Actor) => request("PUT", own + "/consent", actor, { accepted: true, version: surveyNotice.version });
function draft(kind: "INITIAL" | "FINAL" | "COACH" = "INITIAL", start = fixture.starts, day = fixture.today) {
  return {
    kind, programId: fixture.program.id, startedOn: start, catalogueVersion: catalogueFor(kind).version,
    referenceFrom: kind === "INITIAL" ? shiftDay(start, -63) : kind === "FINAL" ? start : shiftDay(day, -7),
    operationId: randomUUID(), expectedVersion: 0, submit: false, answers: {},
  };
}

test("catálogo estable, tipos, omisiones, días civiles y límites de semana 0 y de cierre", () => {
  const catalogue = catalogueFor("INITIAL");
  assert.equal(catalogue.questions.length, new Set(catalogue.questions.map(q => q.id)).size);
  assert.deepEqual(validateAnswers(catalogue, { injury: "no", days: 13, warmup: "na" }, true), {
    answers: { injury: "no", warmup: "na" }, invalid: [],
  });
  assert.deepEqual(validateAnswers(catalogue, { injury: "yes", episodes: "1", absence: "yes", days: 57 }, false).invalid, ["episodes", "days"]);
  assert.deepEqual(validateAnswers(catalogue, {}, false).invalid, []);
  assert.deepEqual(validateAnswers(catalogue, {}, true).invalid, ["injury"]);
  assert.ok(!catalogueFor("FINAL").questions.some(q => q.id === "history"));
  assert.ok(!catalogueFor("COACH").questions.some(q => q.id === "injury"));
  assert.equal(calendarDay(new Date("2027-01-01T04:59:59Z")), "2026-12-31");
  assert.equal(calendarDay(new Date("2027-01-01T05:00:00Z")), "2027-01-01");
  assert.equal(windowFor("INITIAL", "2027-01-01", "2026-12-25"), true);
  assert.equal(windowFor("INITIAL", "2027-01-01", "2027-01-01"), false);
  assert.equal(windowFor("FINAL", "2026-12-31", shiftDay("2026-12-31", 55)), false);
  assert.equal(windowFor("FINAL", "2026-12-31", shiftDay("2026-12-31", 56)), true);
});

test("consentimiento separado, borradores, alcance y concurrencia", async () => {
  assert.equal((await request("GET", own, "owner")).data.consent, false);
  assert.equal((await request("PUT", own, "owner", draft())).status, 403);
  assert.equal((await accept("minor")).status, 403);
  assert.equal((await accept("owner")).status, 204);
  const state = (await request("GET", own, "owner")).data;
  assert.equal(state.slots[0].writable, true);
  assert.equal(state.slots[1].writable, false);
  assert.equal((await request("PUT", own, "owner", draft("FINAL"))).status, 409);
  assert.equal((await request("PUT", own, "owner", { ...draft(), programId: "otro" })).status, 409);
  assert.equal((await request("PUT", own, "owner", { ...draft(), catalogueVersion: "obsoleta" })).status, 409);
  assert.equal((await request("PUT", own, "owner", { ...draft(), submit: true })).status, 422);

  const first = { ...draft(), answers: { injury: "yes", episodes: 2, mechanism: "Giro sintético" } };
  const saved = await request("PUT", own, "owner", first);
  assert.equal(saved.status, 200);
  assert.equal(saved.data.version, 1);
  assert.equal(saved.data.submittedAt, null);
  assert.equal((await request("PUT", own, "owner", first)).data.id, saved.data.id);
  assert.equal((await request("GET", own, "owner")).data.slots[0].record.answers.episodes, 2);
  assert.equal((await request("GET", team(), "physio")).data.records[0].answers, null);
  assert.equal((await request("GET", team(), "unrelated")).status, 404);
  assert.equal((await request("GET", team(), "owner")).status, 403);
  assert.equal((await request("GET", team(), "admin")).status, 403);
  assert.deepEqual((await request("GET", team(), "coach")).data.records, []);
  assert.equal((await request("GET", "/preventive-surveys/team/" + fixture.prior.id, "coach")).status, 404);

  const updates = await Promise.all(["no", "unknown"].map(injury => request("PUT", own, "owner", {
    ...draft(), expectedVersion: 1, answers: { injury, days: 30 },
  })));
  assert.deepEqual(updates.map(r => r.status).sort(), [200, 409]);
  const current = updates.find(r => r.status === 200)!.data;
  assert.equal(current.answers.days, undefined);
  assert.equal((await request("PUT", own, "owner", first)).status, 409);
  const complete = { ...draft(), expectedVersion: 2, submit: true, answers: { injury: "yes", warmup: "often" } };
  const submitted = await request("PUT", own, "owner", complete);
  assert.ok(submitted.data.submittedAt);
  assert.equal((await request("PUT", own, "owner", complete)).data.version, 3);
  assert.equal((await request("PUT", own, "owner", { ...draft(), expectedVersion: 3 })).status, 409);
  const professional = await request("GET", team(), "physio");
  assert.equal(professional.status, 200);
  assert.equal(professional.data.enabled, true);
  assert.equal(professional.data.eligible, false);
  assert.equal(professional.data.consent, true);
  assert.equal(professional.data.athleteName, fixture.owner.fullName);
  assert.equal(professional.data.context.programName, fixture.program.name);
  assert.equal(professional.data.records[0].answers.warmup, "often");
  assert.ok(professional.data.slots.every((slot: { writable: boolean }) => !slot.writable));
  assert.equal((await request("PUT", team(), "physio", draft())).status, 403);
  assert.equal((await request("GET", team() + "/" + saved.data.id + "/history", "physio")).status, 403);
  assert.equal((await request("PUT", team(), "coach", draft())).status, 403);
  assert.equal((await request("PUT", team(), "other", draft())).status, 403);
  assert.equal((await request("GET", own + "/" + saved.data.id + "/history", "owner")).data.revisions.length, 3);
  assert.equal((await request("GET", own + "/" + saved.data.id + "/history", "other")).status, 403);

  const coach = await request("PUT", team(), "coach", { ...draft("COACH"), answers: { warmup: "always" }, submit: true });
  assert.equal(coach.status, 200);
  assert.deepEqual(coach.data.sportContext, {});
  assert.equal((await request("GET", team(), "coach")).data.records.length, 1);
  assert.equal((await request("GET", team() + "/" + saved.data.id + "/history", "coach")).status, 404);
  assert.equal((await request("GET", own, "owner")).data.records.length, 1);
});

test("cierre de la misma intervención, histórico, sesión revocada y retiro de consentimiento", async t => {
  const future = shiftDay(fixture.starts, 56);
  t.mock.timers.enable({ apis: ["Date"], now: new Date(future + "T05:00:00Z") });
  try {
    const final = await request("PUT", own, "owner", { ...draft("FINAL"), submit: true, answers: { injury: "no" } });
    assert.equal(final.status, 200);
    assert.equal(final.data.startedOn, fixture.starts);
    assert.equal(final.data.catalogue.reference.to, shiftDay(fixture.starts, 55));
    const newer = shiftDay(future, 2);
    await prisma.athlete.update({ where: { id: fixture.athlete.id }, data: { programStartedAt: new Date(newer) } });
    const state = await request("GET", own, "owner");
    assert.equal(state.data.slots[0].record, null);
    assert.equal(state.data.records.length, 2);
    assert.equal((await request("PUT", own, "owner", { ...draft("INITIAL", newer), answers: { injury: "no" } })).status, 200);
  } finally {
    t.mock.timers.reset();
  }
  const credential = token("owner");
  const expired = jwt.sign({ sub: fixture.physio.id, role: fixture.physio.role }, config.jwtSecret, { expiresIn: -1 });
  assert.equal((await request("GET", team(), "physio", undefined, expired)).status, 401);
  assert.equal((await request("POST", "/auth/logout", "owner", undefined, credential)).status, 204);
  assert.equal((await request("GET", own, "owner", undefined, credential)).status, 401);
  assert.equal((await request("DELETE", own + "/consent", "owner")).status, 204);
  for (const actor of ["owner", "physio", "coach"] as const) {
    const state = await request("GET", actor === "owner" ? own : team(), actor);
    assert.equal(state.data.consent, false);
    assert.equal(state.data.athleteName, undefined);
    assert.equal(state.data.context, null);
    assert.deepEqual(state.data.slots, []);
    assert.deepEqual(state.data.records, []);
  }
  assert.equal((await accept("owner")).status, 409);
});
