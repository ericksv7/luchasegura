import assert from "node:assert/strict";
import { once } from "node:events";
import { writeFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import ExcelJS from "exceljs";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { config } from "../src/config";
import { prisma } from "../src/db";
import { calculateParticipation, compareEvaluations } from "../src/services/program-report-metrics";
import { seedProgramReports } from "./program-report-fixture";

const start = "2025-01-08";
const today = "2025-04-01";
function testEvaluation(phase: "INITIAL" | "FINAL", value: number, overrides: {
  testType?: string; day?: string; protocol?: string; unit?: string; side?: string; direction?: string; confirmed?: boolean;
} = {}) {
  const { testType = "T_TEST", day = phase === "INITIAL" ? start : "2025-03-05", protocol = "RUN-V1",
    unit, side, direction, confirmed = true } = overrides;
  return { id: phase, testType, phase, version: 2, revisions: [{ version: confirmed ? 2 : 1, measuredOn: new Date(day),
    result: { protocol, measurements: [{ value, ...(unit ? { unit } : {}), ...(side ? { side, direction } : {}) }] } }] };
}

test("pares confirmados por instrumento, fase, ventana, unidad y procedimiento explícito", () => {
  const initial = testEvaluation("INITIAL", 12);
  const final = testEvaluation("FINAL", 9);
  const timed = (rows: typeof initial[]) => compareEvaluations(rows, start, 8, today).find(row => row.instrument === "T_TEST")!;
  assert.deepEqual(timed([final, initial]).changes, [{ key: "Tiempo", initial: 12, final: 9, absolute: -3, percentage: -25 }]);
  for (const rows of [
    [initial], [final], [initial, final, final],
    [initial, testEvaluation("FINAL", 9, { day: "2025-02-01" })],
    [initial, testEvaluation("FINAL", 9, { protocol: "OTHER" })],
    [initial, testEvaluation("FINAL", 9, { unit: "cm" })],
    [initial, testEvaluation("FINAL", 9, { testType: "SEBT" })],
    [initial, testEvaluation("FINAL", 9, { confirmed: false })],
  ]) assert.deepEqual(timed(rows).changes, []);
  const reach = compareEvaluations([
    testEvaluation("INITIAL", 0, { testType: "YBT", side: "LEFT", direction: "Anterior" }),
    testEvaluation("FINAL", 5, { testType: "YBT", side: "LEFT", direction: "Anterior" }),
  ], start, 8, today)[1];
  assert.deepEqual(reach.changes, [{ key: "Izquierda · Anterior", initial: 0, final: 5, absolute: 5, percentage: null }]);
});

test("usa calendario real, conserva el cero y diferencia denominador ausente", () => {
  const schedule = [{ id: "a", week: 1 }, { id: "b", week: 3 }, { id: "c", week: 0 }];
  assert.equal(calculateParticipation(schedule, new Set(["b"]), 8, 1).adherence, 0);
  assert.equal(calculateParticipation(schedule, new Set(), 8, 0).adherence, null);
  const progress = calculateParticipation(schedule, new Set(["a", "b"]), 8, 8);
  assert.equal(progress.planned, 2);
  assert.equal(progress.completed, 2);
  assert.equal(progress.weeksWithRecords, 2);
  assert.equal(progress.adherence, 100);
});

let f: Awaited<ReturnType<typeof seedProgramReports>>;
let server: ReturnType<typeof app.listen>;
let base: string;
before(async () => {
  f = await seedProgramReports();
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/program-reports`;
});
after(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await prisma.$disconnect();
});
const token = (user: { id: string; role: string }, expiresIn: number) => jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn });
const get = (path: string, user: { id: string; role: string }, expiresIn = 90) =>
  fetch(base + path, { headers: { Authorization: "Bearer " + token(user, expiresIn) } });

test("informe individual usa revisiones vigentes, intervalos, filtros y cobertura real", async () => {
  const response = await get("/me", f.owner);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control")!, /no-store/);
  const { report, interventions } = await response.json();
  assert.equal(interventions.length, 2);
  assert.equal(report.intervention.start, f.start);
  assert.equal(report.participation.planned, 24);
  assert.equal(report.participation.completed, 16);
  assert.equal(report.evaluations[2].changes[0].initial, 12);
  assert.equal(report.evaluations[2].changes[0].absolute, -1);
  assert.equal(report.discomfort.reports[0].alerts[0].status, "FOLLOW_UP_PENDING");
  assert.deepEqual(report.wellbeing.map((row: { sleepHours: number }) => row.sleepHours), [8, 0, null, 7.5]);
  assert.equal(report.surveys.comparisons.length, 2);
  assert.doesNotMatch(JSON.stringify(report), /Nota reservada|Texto privado|Observación privada|@example.test/);
  const archived = await (await get(`/me?programId=${f.program.id}&start=${f.past}`, f.owner)).json();
  assert.equal(archived.report.participation, null);
  assert.deepEqual(archived.report.evaluations[2].changes, []);
  assert.equal((await get(`/me?programId=${f.program.id}&start=2000-01-01`, f.owner)).status, 404);
  const partial = (await (await get("/me", f.partial)).json()).report;
  assert.equal(partial.participation.adherence, 0);
  assert.equal(partial.surveys.final.submitted, null);
  assert.equal(partial.wellbeing.length, 0);
  assert.equal((await (await get("/me", f.empty)).json()).report, null);
});

test("respeta alcance, roles, expiración, revocación y paridad de Excel", async () => {
  const path = "/athletes/" + f.athlete.id;
  assert.equal((await get(path, f.physio)).status, 200);
  assert.equal((await get(path, f.outsider)).status, 404);
  assert.equal((await get(path + ".xlsx", f.outsider)).status, 404);
  assert.equal((await get(path, f.coach)).status, 403);
  assert.equal((await get(path, f.admin)).status, 403);
  assert.equal((await get("/me", f.owner, -1)).status, 401);
  assert.equal((await get("/group.xlsx", f.coach)).status, 403);
  const excel = await get(path + ".xlsx", f.physio);
  assert.equal(excel.status, 200);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await excel.arrayBuffer());
  assert.deepEqual(book.worksheets.map(sheet => sheet.name), [
    "Resumen ejecutivo", "Evaluaciones funcionales", "Adherencia", "Molestias y seguimiento", "Bienestar",
    "Trazabilidad", "Encuestas", "Respuestas comparables", "Metodología y definiciones",
  ]);
  const cover = book.worksheets[0];
  assert.equal(cover.getCell("A2").value, "Informe del programa preventivo");
  assert.equal(cover.getCell("H2").master.address, "A2");
  assert.equal(cover.getCell("A18").font.bold, true);
  assert.equal(cover.views[0].showGridLines, false);
  assert.equal(cover.pageSetup.paperSize, 9);
  assert.equal(cover.pageSetup.orientation, "portrait");
  assert.match(cover.pageSetup.printArea, /^A1:H\d+$/);
  assert.match(cover.headerFooter.oddFooter, /&P de &N/);
  const evaluation = book.getWorksheet("Evaluaciones funcionales")!;
  assert.equal(evaluation.getCell("D10").value, 12);
  assert.equal(evaluation.getCell("F10").value, 11);
  assert.equal(evaluation.getCell("H10").value, -1);
  assert.equal(evaluation.getCell("I10").value, (-1 / 12 * 100) / 100);
  assert.equal(evaluation.getCell("I10").numFmt, "0.00%");
  assert.ok(evaluation.getCell("C10").value instanceof Date);
  assert.equal(evaluation.getCell("C10").numFmt, "dd/mm/yyyy");
  assert.equal(evaluation.getCell("C10").isMerged, false);
  assert.equal(evaluation.getCell("A7").fill.type, "pattern");
  assert.equal(evaluation.getColumn("B").width, 22);
  assert.equal(evaluation.autoFilter, "A7:J10");
  assert.equal(evaluation.views[0].ySplit, 7);
  assert.equal(evaluation.pageSetup.printTitlesRow, "1:7");
  assert.equal(evaluation.pageSetup.fitToHeight, 0);
  assert.equal(evaluation.pageSetup.orientation, "landscape");
  const adherence = book.getWorksheet("Adherencia")!;
  assert.deepEqual(adherence.getRow(16).values.slice(1, 4), ["Total al corte", 24, 16]);
  assert.equal(adherence.getCell("E16").value, (16 / 24 * 100) / 100);
  assert.equal(adherence.getCell("E16").font.bold, true);
  assert.equal(adherence.conditionalFormattings[0].ref, "C8:C15");
  assert.equal(book.getWorksheet("Bienestar")?.getCell("B9").value, 0);
  assert.equal(book.getWorksheet("Bienestar")?.getCell("B10").value, "—");
  for (const sheet of book.worksheets) {
    assert.equal(sheet.state, "visible");
    sheet.eachRow(row => row.eachCell(cell => {
      assert.notEqual(cell.type, ExcelJS.ValueType.Formula);
      assert.doesNotMatch(cell.text, /Nota reservada|Texto privado|Seguimiento privado|@example.test/);
    }));
  }
  assert.ok(book.getWorksheet("Encuestas"));
  await prisma.preventiveSurveyConsent.update({ where: { athleteId: f.athlete.id }, data: { revokedAt: new Date() } });
  const revoked = await get(path, f.physio);
  assert.equal((await revoked.json()).report.surveys, null);
  const again = await get(path + ".xlsx", f.physio);
  await book.xlsx.load(await again.arrayBuffer());
  assert.equal(book.getWorksheet("Encuestas"), undefined);
  assert.equal(book.getWorksheet("Respuestas comparables"), undefined);
});

test("agregados sintéticos se limitan a la atención documentada y protegen la divulgación habitual", async () => {
  const group = await get("/group", f.physio);
  const { report } = await group.json();
  assert.equal(report.athletes, 2);
  assert.equal(report.ended, 1);
  assert.equal(report.completed, 16);
  assert.equal(report.calculable, 2);
  assert.equal(report.initial, 2);
  assert.equal(report.final, 1);
  assert.equal(report.comparable, 1);
  assert.equal(report.wellbeingCoverage, 1);
  assert.equal((await (await get("/group", f.outsider)).json()).report.athletes, 0);
  const excel = await get("/group.xlsx", f.physio);
  assert.equal(excel.status, 200);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await excel.arrayBuffer());
  assert.deepEqual(book.worksheets.map(sheet => sheet.name),
    ["Resumen grupal", "Participación y adherencia", "Cobertura de evaluaciones", "Metodología"]);
  const p = book.getWorksheet("Participación y adherencia")!;
  assert.equal(p.getCell("B10").value, report.completed);
  assert.equal(p.getCell("C10").value, report.planned);
  assert.equal(p.getCell("D10").value, report.adherence / 100);
  for (const sheet of book.worksheets) sheet.eachRow(row => row.eachCell(cell => {
    assert.doesNotMatch(cell.text, /completa ·|parcial ·|@example.test/);
  }));
  process.env.PROGRAM_REPORTS_DEMO = "0";
  try {
    assert.equal((await (await get("/group", f.physio)).json()).report, null);
    assert.equal((await get("/group.xlsx", f.physio)).status, 403);
  } finally { process.env.PROGRAM_REPORTS_DEMO = "1"; }
});

test("protocolo opcional integra correcciones y registros incompletos o numerosos", async () => {
  const route = new URL(base).origin + "/api/team/athletes/" + f.partialAthlete.id + "/evaluations";
  const write = (url: string, method: string, body: object) => fetch(url, {
    method, headers: { Authorization: "Bearer " + token(f.physio, 90), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const fields = { measuredOn: f.partialStart, measurements: [{ value: 80, side: "LEFT", direction: "Anterior" }], observations: null };
  const created = await write(route, "POST", {
    ...fields, protocol: "SEBT-DEMO", phase: "INITIAL", instrument: "SEBT",
    intervention: { programId: f.program.id, startedAt: f.partialStart }, operationId: crypto.randomUUID(),
  });
  assert.equal(created.status, 201);
  const { id } = await created.json();
  const edited = await write(route + "/" + id, "PATCH", { ...fields, expectedVersion: 1, operationId: crypto.randomUUID() });
  assert.equal(edited.status, 200);
  const longZone = "Zona sintética con una descripción larga para ajustar filas";
  await prisma.injury.createMany({ data: Array.from({ length: 60 }, (_, index) => ({
    athleteId: f.partialAthlete.id, bodyZone: index === 59 ? longZone : "=1+1", occurredAt: new Date(f.partialStart + "T15:00:00Z"),
  })) });
  const { report } = await (await get("/me", f.partial)).json();
  assert.equal(report.evaluations[0].records[0].version, 2);
  assert.equal(report.evaluations[0].records[0].protocol, "SEBT-DEMO");
  assert.equal(report.evaluations[0].changes.length, 0);
  assert.equal(report.discomfort.reports.length, 60);
  assert.equal(report.discomfort.zones.find((row: { zone: string }) => row.zone === "=1+1").count, 59);
  const book = new ExcelJS.Workbook();
  const contents = await (await get("/me.xlsx", f.partial)).arrayBuffer();
  await book.xlsx.load(contents);
  if (process.env.REPORT_PRINT_FIXTURE) await writeFile(process.env.REPORT_PRINT_FIXTURE, Buffer.from(contents));
  const sheet = book.getWorksheet("Molestias y seguimiento")!;
  assert.equal(sheet.rowCount, 67);
  assert.equal(sheet.pageSetup.printArea, "A1:F67");
  assert.equal(sheet.autoFilter, "A7:F67");
  const rows = sheet.getRows(8, 60)!;
  const long = rows.find(row => row.getCell("B").value === longZone)!;
  assert.ok(long.height > 21 && long.getCell("B").alignment.wrapText);
  const cell = rows.find(row => row.getCell("B").value === "=1+1")?.getCell("B");
  assert.equal(cell?.type, ExcelJS.ValueType.String);
  assert.equal(cell?.value, "=1+1");
});

test("Excel parcial omite secciones vacías y la ausencia de intervención conserva el rechazo", async () => {
  const empty = await get("/me.xlsx", f.empty);
  assert.equal(empty.status, 403);
  assert.doesNotMatch(empty.headers.get("content-type")!, /spreadsheet/);
  const partial = await get("/me.xlsx", f.partial);
  assert.equal(partial.status, 200);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await partial.arrayBuffer());
  assert.equal(book.getWorksheet("Bienestar"), undefined);
  assert.equal(book.getWorksheet("Respuestas comparables"), undefined);
  assert.equal(book.getWorksheet("Adherencia")?.getCell("E16").value, 0);
  assert.equal(book.getWorksheet("Encuestas")?.getCell("B9").value, "Pendiente");
});

test("FMS y LESS: captura, parcial, revisión, permisos y comparación compatible", async () => {
  const { randomUUID } = await import("node:crypto");
  const { fmsPatterns, scoreAssessment } = await import("../src/services/structured-evaluation");
  const denied = await fetch(base.replace("program-reports", `team/athletes/${f.athlete.id}/evaluations`), {
    headers: { Authorization: "Bearer " + token(f.coach, 90) },
  });
  assert.equal(denied.status, 403);
  const url = base.replace("program-reports", `team/athletes/${f.athlete.id}/evaluations`);
  const send = (body: object, id?: string) => fetch(id ? `${url}/${id}` : url, {
    method: id ? "PATCH" : "POST",
    headers: { Authorization: "Bearer " + token(f.physio, 90), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const testData = (instrument: string, phase: string, assessment: unknown, protocol = "DEMO") => ({
    instrument, phase, assessment, protocol, operationId: randomUUID(), observations: "nota privada fase 10",
    measuredOn: phase === "INITIAL" ? f.start : f.today,
    intervention: { programId: f.program.id, startedAt: f.start },
  });
  const fms = { version: "FMS-COOK-2014", patterns: fmsPatterns.map(({ sides, clearing }) => ({
    scores: Array<number | null>(sides).fill(3), clearing: Array<boolean | null>(clearing).fill(false),
  })) };
  assert.equal(scoreAssessment("FMS", fms)?.total, 21);
  const modified = structuredClone(fms);
  modified.patterns[1].scores[0] = 1;
  modified.patterns[3].clearing[1] = true;
  const pain = scoreAssessment("FMS", modified);
  assert.ok(pain && "patterns" in pain && pain.pain && pain.patterns[1].asymmetry && pain.patterns[3].score === 0);
  assert.equal(pain.total, 16);
  const incomplete = structuredClone(fms);
  incomplete.patterns[3].clearing[1] = null;
  const initial = testData("FMS", "INITIAL", incomplete);
  assert.equal((await send({ ...initial, total: 21 })).status, 400);
  const saved = await send(initial);
  assert.equal(saved.status, 201);
  const { id } = await saved.json();
  assert.equal((await send(initial)).status, 200);
  assert.equal((await send({ ...initial, operationId: randomUUID() })).status, 409);
  assert.equal((await get("/me", f.owner)).status, 200);
  const { instrument, phase, intervention, ...revision } = initial;
  assert.equal((await send({ ...revision, operationId: randomUUID(), expectedVersion: 1, assessment: fms }, id)).status, 200);
  const history = await fetch(`${url}/${id}/revisions`, { headers: { Authorization: "Bearer " + token(f.physio, 90) } });
  const revisions = await history.json();
  assert.deepEqual(revisions.map((r: any) => [r.version, r.result.total]), [[2, 21], [1, null]]);
  assert.equal((await send(testData("FMS", "FINAL", fms))).status, 201);

  const less = { version: "LESS-17-MEAN3", trials: Array.from({ length: 3 }, () => Array<number | null>(17).fill(0)) };
  less.trials[0][15] = 2;
  less.trials[1][16] = 2;
  assert.equal(scoreAssessment("LESS", less)?.total, 4 / 3);
  const invalid = structuredClone(less);
  invalid.trials[0][14] = 2;
  assert.equal((await send(testData("LESS", "INITIAL", invalid))).status, 400);
  assert.equal((await send(testData("LESS", "INITIAL", less))).status, 201);
  assert.equal((await send(testData("LESS", "FINAL", less, "OTHER"))).status, 201);

  const report = await (await get("/me", f.owner)).json();
  assert.equal(report.report.evaluations.find((item: any) => item.instrument === "FMS").changes[0].initial, 21);
  assert.deepEqual(report.report.evaluations.find((item: any) => item.instrument === "LESS").changes, []);
  assert.doesNotMatch(JSON.stringify(report), /nota privada fase 10/);
  const workbook = new ExcelJS.Workbook();
  const download = await get("/me.xlsx", f.owner);
  await workbook.xlsx.load(Buffer.from(await download.arrayBuffer()));
  assert.ok(workbook.getWorksheet("Trazabilidad")!.getColumn(1).values.includes("LESS"));
});

test("caracterización de antecedentes y molestias: versiones, fuente, permisos y privacidad", async () => {
  const { randomUUID } = await import("node:crypto");
  const athlete = f.athlete;
  const history = await prisma.injury.create({ data: { athleteId: athlete.id, bodyZone: "Zona libre heredada", isHistory: true } });
  const discomfort = await prisma.injury.findFirstOrThrow({ where: { athleteId: athlete.id, isHistory: false } });
  const origin = new URL(base).origin;
  const path = (id: string) => `${origin}/api/team/athletes/${athlete.id}/injuries/${id}/characterization`;
  const access = (user: typeof f.physio) => ({ Authorization: "Bearer " + token(user, 90), "Content-Type": "application/json" });
  const details = {
    zone: "Rodilla", side: "LEFT", eventOn: null, approximateSince: "2025-01-01", approximateUntil: "2025-02-01",
    recurrent: true, context: "TRAINING", activity: "Práctica sintética", mechanism: null, consequence: null,
    daysAbsent: 7, classification: "Clasificación ficticia", source: "DOCUMENT",
    treatment: "Reserva caso fase 10", prevention: null, caseStatus: "FOLLOW_UP", reason: null,
  };
  const write = (id: string, body: object) => fetch(path(id), {
    method: "PUT", body: JSON.stringify(body), headers: access(f.physio),
  });
  const operationId = randomUUID();
  assert.equal((await fetch(path(history.id), { headers: access(f.coach) })).status, 403);
  assert.equal((await fetch(path(history.id), { headers: access(f.outsider) })).status, 404);
  assert.equal((await write(history.id, { operationId, expectedVersion: 0, details: { ...details, source: "ATHLETE" } })).status, 400);
  assert.equal((await write(history.id, { operationId, expectedVersion: 0, details })).status, 200);
  assert.equal((await write(history.id, { operationId, expectedVersion: 0, details })).status, 200);
  const correction = { ...details, daysAbsent: 8, caseStatus: "RESOLVED", reason: "Registro corregido" };
  assert.equal((await write(history.id, { operationId: randomUUID(), expectedVersion: 1, details: correction })).status, 200);
  assert.equal((await write(discomfort.id, { operationId: randomUUID(), expectedVersion: 0, details: {
    ...details, classification: null, source: "ATHLETE",
  } })).status, 200);
  const versions = await (await fetch(path(history.id), { headers: access(f.physio) })).json();
  assert.deepEqual(versions.map((v: any) => [v.version, v.details.daysAbsent]), [[2, 8], [1, 7]]);
  assert.equal((await prisma.injury.findUniqueOrThrow({ where: { id: history.id } })).bodyZone, "Zona libre heredada");
  assert.equal((await prisma.injury.findUniqueOrThrow({ where: { id: discomfort.id } })).injuryType, null);
  const own = await (await fetch(origin + "/api/injuries/mine", { headers: access(f.owner) })).text();
  assert.doesNotMatch(own, /Reserva caso fase 10/);
  const report = await (await get("/me", f.owner)).text();
  assert.doesNotMatch(report, /Reserva caso fase 10/);
});

test("semana 0: instantánea fechada independiente del perfil y vinculada al ciclo", async () => {
  const { randomUUID } = await import("node:crypto");
  const url = base.replace("program-reports", `team/athletes/${f.athlete.id}/evaluations`);
  const headers = { Authorization: "Bearer " + token(f.physio, 90), "Content-Type": "application/json" };
  const baseline = { version: "WEEK0-V1", age: 20, weight: 64.5, category: "65 kg", experience: 4, style: "libre", historyReviewed: true };
  const body = { operationId: randomUUID(), instrument: "BASELINE", phase: "INITIAL", measuredOn: f.start,
    intervention: { programId: f.program.id, startedAt: f.start }, baseline, observations: null };
  const post = (data: object) => fetch(url, { method: "POST", headers, body: JSON.stringify(data) });
  assert.equal((await post({ ...body, phase: "FINAL" })).status, 400);
  assert.equal((await post({ ...body, measuredOn: f.today })).status, 400);
  const saved = await post(body);
  assert.equal(saved.status, 201);
  const { id } = await saved.json();
  assert.equal((await post({ ...body, operationId: randomUUID() })).status, 409);
  await prisma.athlete.update({ where: { id: f.athlete.id }, data: { weightKg: 66 } });
  const state = await (await fetch(url, { headers })).json();
  const initial = state.tests.find((row: any) => row.id === id);
  assert.equal(initial.result.complete, true);
  assert.equal(initial.result.baseline.weight, 64.5);
  assert.equal((await fetch(`${url}/${id}`, { method: "PATCH", headers, body: JSON.stringify({
    operationId: randomUUID(), measuredOn: f.start, expectedVersion: 1,
    baseline: { ...baseline, historyReviewed: false }, observations: null,
  }) })).status, 200);
  const revisions = await (await fetch(`${url}/${id}/revisions`, { headers })).json();
  assert.deepEqual(revisions.map((row: any) => row.result.complete), [false, true]);
});
