import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { join } from "node:path";
import type { Server } from "node:http";
import { type Role } from "@prisma/client";
import ExcelJS from "exceljs";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { config } from "../src/config";
import { prisma } from "../src/db";

if (process.env.ALERT_REVIEW_TESTS !== "1" || !process.env.DATABASE_URL?.includes("/luchasegura_alert_test")) {
  throw new Error("El reporte de prueba requiere PostgreSQL aislado");
}

let server: Server;
let base: string;
const users = {} as Record<Role, string>;
let athleteId: string;
let another: string;
const name = "=Nombre sintético con tildes, ñ y longitud amplia para comprobar texto literal";
const note = "+SUMA(1,2)";
const observation = "@observación sintética";
const from = "2026-01-01";
const until = "2026-01-02";
const xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const beforeWindow = new Date("2026-01-01T04:59:59.999Z");
const atStart = new Date("2026-01-01T05:00:00.000Z");
const atEnd = new Date("2026-01-03T04:59:59.999Z");
const afterWindow = new Date("2026-01-03T05:00:00.000Z");

before(async () => {
  for (const role of ["ADMIN", "PHYSIO", "COACH", "ATHLETE"] as const) {
    const user = await prisma.user.create({ data: { role, fullName: "Usuario sintético " + role,
      email: randomUUID() + "@example.test", passwordHash: "fixture-only" } });
    users[role] = user.id;
  }
  const athlete = await prisma.athlete.create({ data: { userId: users.ATHLETE, coachId: users.COACH,
    programStartedAt: new Date("2025-12-30"), notes: "Nota de perfil omitida" } });
  const otherUser = await prisma.user.create({ data: { role: "ATHLETE", fullName: name,
    email: randomUUID() + "@example.test", passwordHash: "fixture-only" } });
  const other = await prisma.athlete.create({ data: { userId: otherUser.id } });
  athleteId = athlete.id;
  another = other.id;
  await prisma.user.update({ where: { id: users.ATHLETE }, data: { fullName: name } });

  for (const [occurredAt, state] of [[beforeWindow, null], [atStart, "FOLLOW_UP_PENDING"],
    [atEnd, "REVIEWED"], [afterWindow, "NEW"]] as const) {
    const injury = await prisma.injury.create({ data: { athleteId, occurredAt, bodyZone: "Rodilla",
      intensity: state === "REVIEWED" ? null : 7, notes: note } });
    if (!state) continue;
    const alert = await prisma.alert.create({ data: { injuryId: injury.id, status: state,
      createdAt: state === "REVIEWED" ? beforeWindow : occurredAt, version: state === "NEW" ? 0 : 1 } });
    if (state !== "NEW") await prisma.alertEntry.create({ data: {
      alertId: alert.id, authorId: users.PHYSIO, authorName: "Personal sintético", requestId: randomUUID(),
      version: 1, kind: "REVIEW", previousStatus: state === "REVIEWED" ? "FOLLOW_UP_PENDING" : "NEW",
      status: state, observations: observation, actionTaken: "-actuación sintética",
      followUpRequired: state === "FOLLOW_UP_PENDING",
      followUpDate: state === "FOLLOW_UP_PENDING" ? new Date("2026-01-02") : null, createdAt: occurredAt,
    } });
  }
  await prisma.injury.create({ data: { athleteId, isHistory: true, historyDate: new Date("2026-01-01"),
    bodyZone: "Hombro", recurrent: true } });
  const program = await prisma.program.findFirstOrThrow({ where: { sessions: { some: {} } },
    orderBy: { id: "asc" }, include: { sessions: true } });
  await prisma.completedSession.create({ data: { athleteId, sessionId: program.sessions[0].id, doneAt: atStart } });
  const exercise = await prisma.exercise.create({ data: { name: "Ejercicio sintético", component: "Movilidad", archived: true } });
  await prisma.exerciseAssignment.create({ data: { athleteId, exerciseId: exercise.id, assignedById: users.PHYSIO,
    dosage: "2 series", note: "Indicación sintética", createdAt: atEnd } });

  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${(server.address() as {port: number}).port}/api`;
});

after(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await prisma.$disconnect();
});

function get(path: string, role: Role | null = "PHYSIO") {
  const token = role && jwt.sign({ sub: users[role], role }, config.jwtSecret, { expiresIn: "5m" });
  return fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
}

async function open(query: string) {
  const response = await get("/team/export?" + query);
  if (response.status !== 200) assert.fail(`${response.status} ${await response.text()}`);
  assert.equal(response.headers.get("content-type"), xlsx);
  assert.match(response.headers.get("cache-control")!, /no-store/);
  assert.match(response.headers.get("content-disposition")!, /filename="luchasegura_.*\.xlsx"/);
  const bytes = Buffer.from(await response.arrayBuffer());
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  for (const sheet of book.worksheets) {
    assert.equal(sheet.views[0].state, "frozen");
    assert.equal(sheet.views[0].ySplit, 1);
    if (sheet.name !== "Resumen") assert.ok(sheet.autoFilter);
    sheet.eachRow(row => row.eachCell(cell => assert.notEqual(cell.type, ExcelJS.ValueType.Formula)));
  }
  return { book, bytes };
}

function value(book: ExcelJS.Workbook, title: string) {
  const sheet = book.getWorksheet("Resumen")!;
  const row = sheet.getRows(2, sheet.rowCount - 1)!.find(row => row.getCell(1).value === title);
  assert.ok(row, title);
  return row.getCell(2).value;
}

function column(sheet: ExcelJS.Worksheet, name: string) {
  const cell = sheet.getRow(1).findCell((sheet.getRow(1).values as ExcelJS.CellValue[]).indexOf(name));
  assert.ok(cell, name);
  return Number(cell.col);
}

async function evidence(name: string, bytes: Buffer) {
  const dir = process.env.REPORT_EVIDENCE_DIR;
  if (!dir) return;
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), bytes);
}

test("Excel identificable consolidado usa fechas Bogotá, fechas civiles, tipos y relaciones del mismo conjunto", async () => {
  const { book, bytes } = await open(`athleteId=${athleteId}&from=${from}&to=${until}&privacy=identified`);
  assert.deepEqual(book.worksheets.map(s => s.name), ["Resumen", "Deportistas", "Molestias y antecedentes",
    "Alertas y seguimientos", "Historial profesional", "Programa preventivo", "Sesiones completadas", "Ejercicios asignados"]);
  assert.equal(value(book, "Deportistas en alcance"), 1);
  assert.equal(value(book, "Molestias en el periodo"), 2);
  assert.equal(value(book, "Antecedentes en el periodo"), 1);
  assert.equal(value(book, "Seguimientos vencidos"), 1);
  assert.equal(value(book, "Finalizaciones de seguimiento en el periodo"), 1);
  assert.equal(value(book, "Sesiones registradas en el periodo"), 1);
  const roster = book.getWorksheet("Deportistas")!;
  assert.equal(roster.rowCount, 2);
  const athleteCode = roster.getCell("A2").value;
  assert.equal(roster.getCell("B2").type, ExcelJS.ValueType.String);
  assert.equal(roster.getCell("B2").value, name);

  const reports = book.getWorksheet("Molestias y antecedentes")!;
  assert.equal(reports.rowCount, 4);
  assert.equal(reports.getCell("A3").value, athleteCode);
  const dateCol = column(reports, "Fecha");
  const pain = column(reports, "Intensidad (0–10)");
  assert.equal(reports.getRow(2).getCell(dateCol).numFmt, "dd/mm/yyyy");
  assert.equal(+(reports.getRow(2).getCell(dateCol).value as Date), +new Date("2026-01-01"));
  assert.equal(+(reports.getRow(3).getCell(dateCol).value as Date), +new Date("2026-01-01"));
  assert.equal(reports.getRow(3).getCell(pain).type, ExcelJS.ValueType.Number);
  assert.equal(reports.getRow(4).getCell(pain).value, null);
  assert.equal(reports.getRow(3).getCell(column(reports, "Notas del reporte")).value, note);

  const alerts = book.getWorksheet("Alertas y seguimientos")!;
  const history = book.getWorksheet("Historial profesional")!;
  assert.equal(alerts.rowCount, 3);
  assert.equal(history.rowCount, 3);
  assert.equal(history.getRow(2).getCell(column(history, "Observaciones")).value, observation);
  assert.equal(alerts.getRow(2).getCell(column(alerts, "Fecha sugerida")).value, null);
  assert.equal(+(alerts.getRow(3).getCell(column(alerts, "Fecha sugerida")).value as Date), +new Date("2026-01-02"));
  assert.equal(history.getRow(3).getCell(column(history, "Referencia de alerta")).value,
    alerts.getRow(2).getCell(column(alerts, "Referencia de alerta")).value);

  const progress = book.getWorksheet("Programa preventivo")!;
  const dashboard = await (await get("/team/overview")).json() as { athletes: { id: string; planned: number; done: number; compliance: number }[] };
  const row = dashboard.athletes.find(a => a.id === athleteId)!;
  assert.equal(progress.getRow(2).getCell(column(progress, "Sesiones previstas al corte")).value, row.planned);
  assert.equal(progress.getRow(2).getCell(column(progress, "Sesiones completadas al corte")).value, row.done);
  const percent = progress.getRow(2).getCell(column(progress, "Adherencia"));
  assert.equal(percent.value, row.compliance / 100);
  assert.equal(percent.numFmt, "0%");
  assert.equal(+(progress.getRow(2).getCell(column(progress, "Inicio de intervención")).value as Date), +new Date("2025-12-30"));
  const assignment = book.getWorksheet("Ejercicios asignados")!;
  assert.equal(assignment.getRow(2).getCell(column(assignment, "Estado en biblioteca")).value, "Archivado");
  assert.equal(assignment.getRow(2).getCell(column(assignment, "Dosificación registrada")).value, "2 series");
  await evidence("consolidado-identificable-sintetico.xlsx", bytes);
});

test("Excel seudonimizado no conserva identificadores, texto libre ni códigos reutilizables", async () => {
  const query = `athleteId=${athleteId}&from=${from}&to=${until}`;
  const first = await open(query + "&privacy=coded");
  const second = await open(query + "&anon=1");
  const defaults = await open(query);
  assert.equal(value(second.book, "Privacidad"), "Seudonimizado");
  assert.equal(value(defaults.book, "Privacidad"), "Seudonimizado");
  const firstCode = first.book.getWorksheet("Deportistas")!.getCell("A2").value;
  assert.notEqual(firstCode, second.book.getWorksheet("Deportistas")!.getCell("A2").value);
  for (const book of [first.book, second.book, defaults.book]) for (const sheet of book.worksheets) {
    sheet.eachRow(row => row.eachCell(cell => {
      if (typeof cell.value === "string") {
        for (const forbidden of [name, note, observation, athleteId, "example.test", "Indicación sintética", "Ejercicio sintético", "Personal sintético"]) {
          assert.ok(!cell.value.includes(forbidden), forbidden);
        }
      }
    }));
  }
  const code = first.book.getWorksheet("Programa preventivo")!.getCell("B2").value;
  assert.equal(code, first.book.getWorksheet("Sesiones completadas")!.getCell("B2").value);
  await evidence("consolidado-seudonimizado-sintetico.xlsx", first.bytes);
});

test("El alcance, los estados, los filtros no aplicables y los permisos se validan en servidor", async () => {
  for (const role of ["ADMIN", "COACH", "ATHLETE", null] as const) {
    // El entrenador tiene un deportista asignado. También se prueba un ID ajeno.
    for (const id of [athleteId, another]) {
      assert.equal((await get(`/team/export?athleteId=${id}`, role)).status, role ? 403 : 401);
    }
  }
  assert.equal((await get("/team/export?athleteId=" + randomUUID())).status, 404);
  for (const query of ["athleteId=no", "from=2026-02-30", "from=2026-02-01&to=2026-01-01",
    "report=athletes&from=2026-01-01", "report=program&status=NEW", "status=ELIMINADA", "foo=1", "anon=1&privacy=identified"]) {
    assert.equal((await get("/team/export?" + query)).status, 400, query);
  }
  const { book } = await open(`report=alerts&athleteId=${athleteId}&status=PENDING`);
  assert.deepEqual(book.worksheets.map(sheet => sheet.name), ["Resumen", "Alertas y seguimientos", "Historial profesional"]);
  const list = await (await get(`/team/alerts?athleteId=${athleteId}&status=PENDING`)).json() as unknown[];
  assert.equal(book.getWorksheet("Alertas y seguimientos")!.rowCount - 1, list.length);
  const all = await open("report=alerts");
  const overview = await (await get("/team/overview")).json() as { stats: { newAlerts: number; followUpAlerts: number } };
  assert.equal(Number(value(all.book, "Alertas · Pendiente de revisión")) + Number(value(all.book, "Alertas · En revisión")), overview.stats.newAlerts);
  assert.equal(value(all.book, "Alertas abiertas de seguimiento"), overview.stats.followUpAlerts);
  const empty = await open(`report=injuries&athleteId=${another}`);
  assert.equal(empty.book.getWorksheet("Molestias y antecedentes")!.rowCount, 1);
  assert.equal(value(empty.book, "Molestias en el periodo"), 0);
  const noProgress = await open(`report=program&athleteId=${another}`);
  const sheet = noProgress.book.getWorksheet("Programa preventivo")!;
  assert.equal(sheet.getRow(2).getCell(column(sheet, "Adherencia")).value, null);
  assert.equal(sheet.getRow(2).getCell(column(sheet, "Estado del indicador")).value, "Sin sesiones previstas");
});

test("El plan vigente rechaza escrituras en sesiones de otro programa y conserva el historial anterior", async () => {
  const older = await prisma.program.create({ data: { id: "zz-plan-historico-fixture", name: "Programa anterior sintético",
    weeks: 1, sessionsPerWeek: 1, sessions: { create: { week: 1, number: 1 } } },
    include: { sessions: true } });
  const sessionId = older.sessions[0].id;
  const token = jwt.sign({ sub: users.ATHLETE, role: "ATHLETE" }, config.jwtSecret, { expiresIn: "5m" });
  const update = await fetch(base + `/program/sessions/${sessionId}/toggle`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: '{"done":true}',
  });
  assert.equal(update.status, 404);
  assert.equal(await prisma.completedSession.count({ where: { athleteId, sessionId } }), 0);
  await prisma.completedSession.create({ data: { athleteId, sessionId, doneAt: atStart } });
  const { book } = await open(`report=program&athleteId=${athleteId}&from=${from}&to=${until}&privacy=identified`);
  assert.equal(value(book, "Sesiones registradas en el periodo"), 2);
  const progressSheet = book.getWorksheet("Programa preventivo")!;
  assert.equal(progressSheet.getRow(2).getCell(column(progressSheet, "Sesiones completadas al corte")).value, 1);
  assert.ok(book.getWorksheet("Sesiones completadas")!.getRows(2, 2)?.some(row => row.getCell(3).value === older.name));
});

test("Excel lee más de una página y rechaza el exceso de filas de forma explícita", async () => {
  const synthetic = { athleteId: another, bodyZone: "Zona sintética", occurredAt: atStart, intensity: 4 };
  await prisma.injury.createMany({ data: Array.from({ length: 301 }, () => synthetic) });
  const result = await open(`report=injuries&athleteId=${another}`);
  assert.equal(result.book.getWorksheet("Molestias y antecedentes")!.rowCount - 1, 301);
  assert.equal(value(result.book, "Molestias en el periodo"), 301);
  await prisma.injury.createMany({ data: Array.from({ length: 4700 }, () => synthetic) });
  const limited = await get(`/team/export?report=injuries&athleteId=${another}`);
  assert.equal(limited.status, 422);
  assert.match((await limited.json() as { error: string }).error, /5000/);
  const smaller = await open(`report=injuries&athleteId=${another}&from=2026-02-01`);
  assert.equal(value(smaller.book, "Molestias en el periodo"), 0);
});


test("Excel deja vacía la fecha del antecedente cuando no fue registrada", async () => {
  const athlete = await prisma.athlete.create({ data: { user: { create: {
    email: "excel-history-date@example.test", fullName: "Atleta sintético de fechas", passwordHash: "fixture", role: "ATHLETE",
  } } } });
  await prisma.injury.create({ data: { athleteId: athlete.id, isHistory: true, bodyZone: "Tobillo" } });
  const query = `report=injuries&athleteId=${athlete.id}`;
  const all = await open(query);
  const sheet = all.book.getWorksheet("Molestias y antecedentes")!;
  const date = column(sheet, "Fecha");
  assert.equal(sheet.rowCount, 2);
  assert.equal(sheet.getRow(2).getCell(date).value, null);
  const ranged = await open(query + "&from=1900-01-01");
  assert.equal(ranged.book.getWorksheet("Molestias y antecedentes")!.rowCount, 1);
});
