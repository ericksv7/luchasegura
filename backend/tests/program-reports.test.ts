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
