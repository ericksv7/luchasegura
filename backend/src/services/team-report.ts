import { randomBytes } from "node:crypto";
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { ALERT_STATUS_LABEL, alertStatusFilter, type AlertFilter } from "./alert-status";
import { calendarDay, loadProgramProgress, progress } from "./program";

export const REPORTS = ["all", "athletes", "injuries", "alerts", "program", "assignments"] as const;
type Report = typeof REPORTS[number];
type Options = {
  report: Report; privacy: "identified" | "coded"; now: Date;
  athleteId?: string; from?: string; to?: string; status?: AlertFilter;
};
const TITLES: Record<Report, string> = {
  all: "Consolidado", athletes: "Deportistas", injuries: "Molestias y antecedentes",
  alerts: "Alertas y seguimientos", program: "Programa preventivo", assignments: "Ejercicios asignados",
};
const MAX_ROWS = 5000;
const BOGOTA_OFFSET = 5 * 60 * 60 * 1000;
const DAY = "dd/mm/yyyy";
const TIME = "dd/mm/yyyy hh:mm";
const PERCENT = "0%";

export class MissingAthlete extends Error {}
export class ReportLimit extends Error {
  constructor() {
    super("El reporte supera 5000 filas de datos. Selecciona un deportista, un módulo o un periodo más corto.");
  }
}

function dateWindow(from: string | undefined, to: string | undefined, civil = false) {
  const offset = civil ? "Z" : "-05:00";
  return {
    ...(from ? { gte: new Date(`${from}T00:00:00${offset}`) } : {}),
    ...(to ? { lt: new Date(+new Date(`${to}T00:00:00${offset}`) + 86400000) } : {}),
  };
}

// Excel almacena un número de calendario sin zona horaria.
const bogota = (date: Date) => new Date(+date - BOGOTA_OFFSET);
const dayOnly = (date: Date) => new Date(date.toISOString().slice(0, 10));
const LIMITS = { NONE: "No limita", PARTIAL: "Limita parcialmente", FULL: "Impide entrenar" };
function actionLabel(entry: { kind: "START" | "REVIEW" | "REOPEN"; previousStatus: string; status: string }) {
  if (entry.kind === "REOPEN") return "Reapertura";
  const followUp = entry.previousStatus === "FOLLOW_UP_PENDING";
  if (entry.kind === "START") return followUp ? "Inicio de seguimiento" : "Inicio de revisión";
  if (!followUp) return "Revisión";
  return entry.status === "REVIEWED" ? "Finalización de seguimiento" : "Seguimiento registrado";
}
const VISIBILITY = { identified: "Identificable", coded: "Seudonimizado" };

type Cell = string | number | Date | null;
type Column = [label: string, width: number, format?: string];
function addSheet(book: ExcelJS.Workbook, name: string, columns: Column[], rows: Cell[][]) {
  const sheet = book.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map(([header, width, numFmt]) => ({ header, width, style: { numFmt } }));
  // Los strings son celdas de texto de ExcelJS, incluso si empiezan por =, +, - o @.
  for (const values of rows) {
    const row = sheet.addRow(values);
    const lines = Math.max(1, ...values.map((value, i) => typeof value === "string"
      ? value.split(/\r?\n/).reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / (columns[i][1] * .85))), 0)
      : 1));
    if (lines > 1) row.height = Math.min(lines, 5) * 17;
  }
  for (const column of sheet.columns) column.alignment = { vertical: "middle", wrapText: true };
  const head = sheet.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B6E5C" } };
  head.alignment = { vertical: "middle", wrapText: true };
  head.height = 29;
  if (name !== "Resumen") {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  }
}

export async function buildTeamReport(options: Options) {
  const { report, privacy, athleteId, from, to, now, status = "ALL" } = options;
  const coded = privacy === "coded";
  const selected = (kind: Report) => report === "all" || report === kind;
  const period = dateWindow(from, to);
  const hasPeriod = !!(from || to);
  const statusWhere = alertStatusFilter(status);
  const athleteWhere = athleteId ? { athleteId } : {};
  const budget = { used: 0 };
  const take = () => MAX_ROWS - budget.used + 1;
  function bounded<T>(rows: T[]): T[] {
    budget.used += rows.length;
    if (budget.used > MAX_ROWS) throw new ReportLimit();
    return rows;
  }

  const data = await prisma.$transaction(async tx => {
    const athletes = bounded(await tx.athlete.findMany({
      where: athleteId ? { id: athleteId } : {},
      select: { id: true, programStartedAt: true, user: { select: { fullName: true } } },
      orderBy: [{ user: { fullName: "asc" } }, { id: "asc" }], take: take(),
    }));
    if (athleteId && !athletes.length) throw new MissingAthlete();

    const injuries = selected("injuries") ? bounded(await tx.injury.findMany({
      where: { ...athleteWhere, ...(hasPeriod ? { OR: [
        { isHistory: false, occurredAt: period },
        { isHistory: true, occurredAt: dateWindow(from, to, true) },
      ] } : {}) },
      select: { athleteId: true, isHistory: true, occurredAt: true, bodyZone: true,
        intensity: true, limitation: true, daysAbsent: true, recurrent: true, notes: !coded },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }], take: take(),
    })) : [];

    const alerts = selected("alerts") ? bounded(await tx.alert.findMany({
      where: { ...statusWhere, injury: athleteWhere, ...(hasPeriod ? { OR: [
        { createdAt: period }, { entries: { some: { createdAt: period } } },
      ] } : {}) },
      select: { id: true, status: true, createdAt: true, injury: { select: { athleteId: true, bodyZone: true } },
        entries: { where: { kind: "REVIEW" }, orderBy: { version: "desc" }, take: 1, select: { followUpDate: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: take(),
    })) : [];

    const entries = alerts.length ? bounded(await tx.alertEntry.findMany({
      where: { alertId: { in: alerts.map(alert => alert.id) }, createdAt: period },
      select: { alertId: true, version: true, kind: true, previousStatus: true, status: true, createdAt: true,
        followUpDate: true, authorName: !coded, observations: !coded, actionTaken: !coded },
      orderBy: [{ createdAt: "asc" }, { alertId: "asc" }, { version: "asc" }], take: take(),
    })) : [];

    const completed = selected("program") ? bounded(await tx.completedSession.findMany({
      where: { ...athleteWhere, doneAt: period },
      select: { athleteId: true, doneAt: true, session: { select: {
        week: true, number: true, program: { select: { id: true, name: true } },
      } } },
      orderBy: [{ doneAt: "asc" }, { id: "asc" }], take: take(),
    })) : [];

    const program = selected("program") ? await loadProgramProgress(tx, take()) : null;
    const currentDone = new Map<string, Set<string>>();
    if (program) {
      bounded(program.sessions);
      const rows = bounded(await tx.completedSession.findMany({
        where: { ...athleteWhere, session: { programId: program.id } },
        select: { athleteId: true, sessionId: true }, take: take(),
      }));
      for (const row of rows) {
        const sessions = currentDone.get(row.athleteId) ?? new Set<string>();
        sessions.add(row.sessionId);
        currentDone.set(row.athleteId, sessions);
      }
    }
    const assignments = selected("assignments") ? bounded(await tx.exerciseAssignment.findMany({
      where: { ...athleteWhere, createdAt: period },
      select: { athleteId: true, createdAt: true, dosage: !coded, note: !coded,
        exercise: { select: { id: true, name: !coded, component: true, archived: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: take(),
    })) : [];
    return { athletes, injuries, alerts, entries, completed, program, currentDone, assignments };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000 });

  const book = new ExcelJS.Workbook();
  book.creator = "LuchaSegura";
  book.created = now;
  const code = () => randomBytes(8).toString("hex").toUpperCase();
  const people = new Map(data.athletes.map(a => [a.id, { code: `D-${code()}`, name: a.user.fullName }]));
  const person = (id: string) => people.get(id)!;
  const athlete = (id: string) => coded ? [person(id).code] : [person(id).code, person(id).name];
  const roster = coded ? [...data.athletes].sort((a, b) => person(a.id).code.localeCompare(person(b.id).code)) : data.athletes;
  const athleteColumns: Column[] = [["Código de deportista", 24], ...(!coded ? [["Deportista", 38] as Column] : [])];
  const alertRefs = new Map(data.alerts.map((alert, i) => [alert.id, { number: i + 1, athleteId: alert.injury.athleteId }]));
  const metrics = roster.map(a => ({ a, p: progress(data.program, a.programStartedAt, data.currentDone.get(a.id) ?? new Set(), now) }));
  const withPlan = metrics.filter(row => row.p.planned > 0);
  const mean = withPlan.length ? Math.round(withPlan.reduce((sum, row) => sum + row.p.compliance, 0) / withPlan.length) / 100 : null;
  const today = calendarDay(now);
  const summary: Cell[][] = [
    ["Reporte", TITLES[report]], ["Privacidad", VISIBILITY[privacy]],
    ["Alcance", athleteId ? athlete(athleteId).join(" · ") : "Deportistas bajo alcance de fisioterapia"],
    ["Generado (hora de Bogotá)", bogota(now)],
    ["Periodo de actividad", `${from ?? "Sin fecha inicial"} / ${to ?? "Sin fecha final"} · límites inclusivos`],
    ["Deportistas en alcance", data.athletes.length],
    ["Lectura de celdas vacías", "Dato ausente, no aplicable o excluido por privacidad"],
  ];
  if (coded) summary.push(["Uso académico", "Códigos por archivo. Las fechas y combinaciones de datos aún pueden permitir la reidentificación."]);
  if (selected("injuries")) summary.push(
    ["Molestias en el periodo", data.injuries.filter(row => !row.isHistory).length],
    ["Antecedentes en el periodo", data.injuries.filter(row => row.isHistory).length],
  );
  if (selected("alerts")) {
    summary.push(["Filtro de alertas", status === "ALL" ? "Todos" : status === "PENDING" ? "Pendientes de revisión" : ALERT_STATUS_LABEL[status]]);
    for (const state of Object.keys(ALERT_STATUS_LABEL) as (keyof typeof ALERT_STATUS_LABEL)[]) {
      summary.push([`Alertas · ${ALERT_STATUS_LABEL[state]}`, data.alerts.filter(alert => alert.status === state).length]);
    }
    const agenda = data.alerts.filter(alert => alert.status === "FOLLOW_UP_PENDING");
    const dueDates = agenda.flatMap(alert => alert.entries[0]?.followUpDate ? [alert.entries[0].followUpDate.toISOString().slice(0, 10)] : []);
    summary.push(["Alcance de alertas", "Estado actual. Se incluyen alertas creadas o con actuaciones en el periodo."],
      ["Seguimientos vencidos", dueDates.filter(due => due < today).length],
      ["Seguimientos con fecha de hoy o futura", dueDates.filter(due => due >= today).length],
      ["Seguimientos sin fecha", agenda.length - dueDates.length],
      ["Alertas abiertas de seguimiento", agenda.length],
      ["Revisiones registradas en el periodo", data.entries.filter(row => row.kind === "REVIEW" && row.previousStatus !== "FOLLOW_UP_PENDING").length],
      ["Actuaciones para seguimientos en el periodo", data.entries.filter(row => row.kind === "REVIEW" && row.previousStatus === "FOLLOW_UP_PENDING").length],
      ["Finalizaciones de seguimiento en el periodo", data.entries.filter(row =>
        row.kind === "REVIEW" && row.previousStatus === "FOLLOW_UP_PENDING" && row.status === "REVIEWED").length]);
  }
  if (selected("program")) summary.push(["Sesiones registradas en el periodo", data.completed.length],
    ["Corte del programa", `Estado actual al ${today}. El periodo solo filtra el registro de sesiones completadas.`],
    ["Deportistas con sesiones previstas al corte", withPlan.length], ["Adherencia media al corte", mean]);
  if (selected("assignments")) summary.push(["Asignaciones vigentes creadas en el periodo", data.assignments.length]);
  addSheet(book, "Resumen", [["Indicador", 54], ["Valor", 90]], summary);
  const summarySheet = book.getWorksheet("Resumen")!;
  if (mean !== null && selected("program")) {
    summarySheet.getCell(summary.findIndex(([label]) => label === "Adherencia media al corte") + 2, 2).numFmt = PERCENT;
  }
  summarySheet.getCell("B5").numFmt = TIME;
  summarySheet.getColumn(2).alignment = { vertical: "middle", wrapText: true };

  if (selected("athletes")) addSheet(book, "Deportistas", athleteColumns, roster.map(a => athlete(a.id)));
  if (selected("injuries")) addSheet(book, "Molestias y antecedentes", [
    ...athleteColumns, ["Tipo de registro", 18], ["Fecha", 21, TIME],
    ...(!coded ? [["Zona", 22] as Column] : []), ["Intensidad (0–10)", 18],
    ["Limitación", 23], ["Días sin entrenar", 18], ["Recurrente", 13],
    ...(!coded ? [["Notas del reporte", 54] as Column] : []),
  ], data.injuries.map(r => [...athlete(r.athleteId), r.isHistory ? "Antecedente" : "Molestia",
    r.isHistory ? dayOnly(r.occurredAt) : bogota(r.occurredAt),
    ...(!coded ? [r.bodyZone] : []), r.intensity, LIMITS[r.limitation], r.daysAbsent, r.recurrent ? "Sí" : "No",
    ...(!coded ? [r.notes] : []),
  ]));
  if (selected("injuries")) {
    const sheet = book.getWorksheet("Molestias y antecedentes")!;
    data.injuries.forEach((row, i) => { if (row.isHistory) sheet.getCell(i + 2, athleteColumns.length + 2).numFmt = DAY; });
  }

  if (selected("alerts")) {
    addSheet(book, "Alertas y seguimientos", [...athleteColumns, ["Referencia de alerta", 20], ["Estado actual", 25],
      ["Generada (Bogotá)", 23, TIME], ["Fecha sugerida", 18, DAY], ["Agenda", 18],
      ...(!coded ? [["Zona", 22] as Column] : []),
    ], data.alerts.map((a, i) => {
      const isOpen = a.status === "FOLLOW_UP_PENDING";
      const date = isOpen ? a.entries[0]?.followUpDate ?? null : null;
      const due = date?.toISOString().slice(0, 10);
      return [...athlete(a.injury.athleteId), i + 1, ALERT_STATUS_LABEL[a.status], bogota(a.createdAt), date,
        !isOpen ? null : !due ? "Sin fecha" : due < today ? "Vencido" : due === today ? "Para hoy" : "Programado",
        ...(!coded ? [a.injury.bodyZone] : [])];
    }));
    addSheet(book, "Historial profesional", [...athleteColumns, ["Referencia de alerta", 20], ["Versión", 12],
      ["Actuación", 27], ["Registrada (Bogotá)", 24, TIME], ["Estado anterior", 26],
      ["Estado resultante", 26], ["Fecha sugerida", 18, DAY],
      ...(!coded ? [["Profesional", 32], ["Observaciones", 54], ["Actuación registrada", 54]] as Column[] : []),
    ], data.entries.map(entry => {
      const ref = alertRefs.get(entry.alertId)!;
      return [...athlete(ref.athleteId), ref.number, entry.version, actionLabel(entry), bogota(entry.createdAt),
        ALERT_STATUS_LABEL[entry.previousStatus], ALERT_STATUS_LABEL[entry.status], entry.followUpDate,
        ...(!coded ? [entry.authorName, entry.observations, entry.actionTaken] : [])];
    }));
  }
  if (selected("program")) {
    const programCodes = new Map<string, string>();
    const programName = (program: { id: string; name: string }) => {
      if (!coded) return program.name;
      if (!programCodes.has(program.id)) programCodes.set(program.id, `P-${code()}`);
      return programCodes.get(program.id)!;
    };
    addSheet(book, "Programa preventivo", [...athleteColumns, [coded ? "Código de programa al corte" : "Programa al corte", 34], ["Inicio de intervención", 22, DAY],
      ["Semana actual", 16], ["Sesiones previstas al corte", 24], ["Sesiones completadas al corte", 25],
      ["Adherencia", 14, PERCENT], ["Estado del indicador", 24],
    ], metrics.map(({ a, p }) => [...athlete(a.id), data.program ? programName(data.program) : null,
      a.programStartedAt, p.week || null, p.planned, p.done, p.planned ? p.compliance / 100 : null,
      !data.program ? "Sin programa" : p.planned ? "Calculado" : "Sin sesiones previstas"]));
    addSheet(book, "Sesiones completadas", [...athleteColumns, [coded ? "Código de programa" : "Programa", 33],
      ["Semana", 12], ["Sesión", 12], ["Registro (Bogotá)", 24, TIME],
    ], data.completed.map(row => [...athlete(row.athleteId), programName(row.session.program),
      row.session.week, row.session.number, bogota(row.doneAt)]));
  }
  if (selected("assignments")) {
    const codes = new Map<string, string>();
    addSheet(book, "Ejercicios asignados", [...athleteColumns, [coded ? "Código de ejercicio" : "Ejercicio", 35],
      ["Componente", 18], ["Asignación (Bogotá)", 24, TIME], ["Estado en biblioteca", 21],
      ...(!coded ? [["Dosificación registrada", 25], ["Indicaciones individuales", 54]] as Column[] : []),
    ], data.assignments.map(row => {
      if (coded && !codes.has(row.exercise.id)) codes.set(row.exercise.id, `E-${code()}`);
      const component = row.exercise.component;
      return [...athlete(row.athleteId), coded ? codes.get(row.exercise.id)! : row.exercise.name,
        !coded || ["Movilidad", "Estabilidad", "Fuerza", "Técnica"].includes(component) ? component : null,
        bogota(row.createdAt), row.exercise.archived ? "Archivado" : "Disponible",
        ...(!coded ? [row.dosage, row.note] : [])];
    }));
  }
  return book;
}
