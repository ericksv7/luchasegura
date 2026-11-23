import { Router, type Request, type Response } from "express";
import ExcelJS from "exceljs";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { calendarDay } from "../services/program";
import { groupReport, individualReport } from "../services/program-report";

const filters = z.object({ programId: z.string().min(1).max(128), start: z.iso.date() }).strict()
  .or(z.object({}).strict());
const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
type Individual = NonNullable<Awaited<ReturnType<typeof individualReport>>>;
type Group = Awaited<ReturnType<typeof groupReport>>;
const unavailable = "No disponible";
let activeExports = 0;

function workbook(data: Individual | Group) {
  const book = new ExcelJS.Workbook();
  const sheet = (name: string, rows: (string | number | null)[][]) => {
    const tab = book.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    tab.addRows(rows.map(row => row.map(value => value ?? unavailable)));
    tab.getRow(1).font = { bold: true };
    tab.columns.forEach(column => { column.width = 30; });
  };
  const heading: (string | number | null)[][] = [["Indicador", "Valor"], ["Generado", data.generatedAt]];
  const report = data.report;
  if (!report) { sheet("Resumen", [...heading, ["Informe", unavailable]]); return book; }

  if ("intervention" in report) {
    const p = report.participation;
    sheet("Resumen", [...heading, ["Programa", report.intervention.name], ["Inicio", report.intervention.start],
      ["Periodo analizado hasta", report.through], ["Término previsto", report.plannedEnd], ["Estado", report.status],
      ["Sesiones programadas", p?.planned ?? null], ["Programadas hasta el corte", p?.plannedToDate ?? null],
      ["Completadas", p?.completed ?? null], ["Pendientes hasta el corte", p?.pending ?? null],
      ["Semanas con registros", p?.weeksWithRecords ?? null], ["Adherencia (%)", p?.adherence ?? null],
      ["Denominador", report.denominatorDefinition], ["Alcance", report.descriptiveNote]]);
    if (p) sheet("Semanas", [["Semana", "Programadas", "Completadas"], ...p.rows.map(row => [row.week, row.planned, row.completed])]);
    sheet("Mediciones", [["Instrumento", "Fase", "Fecha", "Versión", "Procedimiento", "Medición", "Resultado", "Unidad"],
      ...report.evaluations.flatMap(item => item.records.flatMap(row =>
        (row.values.length ? row.values : [{ key: unavailable, value: null }]).map(value =>
          [item.name, row.phase, row.day, row.version, row.protocol, value.key, value.value, item.unit])))]);
    sheet("Comparaciones", [["Instrumento", "Medición", "Inicial", "Final", "Unidad", "Diferencia", "Cambio (%)"],
      ...report.evaluations.flatMap(item => item.changes.length
        ? item.changes.map(row => [item.name, row.key, row.initial, row.final, item.unit, row.absolute, row.percentage])
        : [[item.name, "Sin mediciones comparables"]])]);
    if (report.discomfort) {
      sheet("Molestias", [["Fecha", "Zona", "Seguimiento", "Fecha del evento", "Evento", "Estado del evento"],
        ...report.discomfort.reports.flatMap(row => row.alerts.length ? row.alerts.flatMap(item => item.events.length
          ? item.events.map(event => [row.day, row.zone, item.status, event.day, event.kind, event.status])
          : [[row.day, row.zone, item.status]]) : [[row.day, row.zone, "Sin alerta"]])]);
    }
    sheet("Bienestar", [["Fecha", "Sueño (h)", "Fatiga", "Recuperación"],
      ...report.wellbeing.map(row => [row.day, row.sleepHours, row.fatigue, row.recovery])]);
    if (report.surveys) {
      sheet("Encuestas", [["Fase", "Presentada", "Referencia desde", "Referencia hasta"],
        ["Inicial", report.surveys.initial.submitted, report.surveys.initial.reference?.from ?? null, report.surveys.initial.reference?.to ?? null],
        ["Final", report.surveys.final.submitted, report.surveys.final.reference?.from ?? null, report.surveys.final.reference?.to ?? null]]);
      sheet("Respuestas comparables", [["Pregunta", "Inicial", "Final"],
        ...report.surveys.comparisons.map(row => [row.question, row.initial, row.final])]);
    }
  } else {
    sheet("Grupo", [...heading, ["Programa", report.program], ["Corte", report.through], ["Deportistas", report.athletes],
      ["Activas", report.active], ["Periodo terminado", report.ended], ["Programadas hasta el corte", report.planned],
      ["Completadas", report.completed], ["Adherencia calculable", report.calculable], ["Adherencia (%)", report.adherence],
      ["Con evaluación inicial", report.initial], ["Con evaluación final", report.final], ["Pares por instrumento", report.comparable],
      ["Registros de molestias", report.discomfort], ["Ciclos sin solapamiento", report.unambiguous],
      ["Con registros de bienestar", report.wellbeingCoverage],
      ["Denominador", report.denominatorDefinition]]);
  }
  return book;
}

async function respond(req: Request, res: Response, group: boolean) {
  const query = (group ? z.object({}).strict() : filters).safeParse(req.query);
  if (!query.success) return res.status(400).json({ error: "Selecciona una intervención válida." });
  const exporting = req.path.endsWith(".xlsx");
  if (exporting && activeExports >= 2) return res.status(429).json({ error: "Hay informes en generación. Inténtalo de nuevo." });
  if (exporting) activeExports++;
  try {
    const now = new Date();
    const data = group ? await groupReport(req.user!, now)
      : await individualReport(req.user!, req.params.id, "start" in query.data ? query.data as { start: string; programId: string } : undefined, now);
    if (!data) return res.status(404).json({ error: "Intervención o deportista no disponible." });
    if (!exporting) return res.json(data);
    if (!data.report) return res.status(403).json({ error: "La exportación requiere un informe disponible." });
    const content = Buffer.from(await workbook(data).xlsx.writeBuffer());
    return res.type(mime).attachment(`luchasegura_informe_${group ? "grupal" : "individual"}_${calendarDay(now)}.xlsx`).send(content);
  } finally {
    if (exporting) activeExports--;
  }
}

export const programReports = Router();
programReports.use(requireAuth);
programReports.get(["/me", "/me.xlsx"], requireRole("ATHLETE"), (req, res) => respond(req, res, false));
programReports.get(["/athletes/:id.xlsx", "/athletes/:id"], requireRole("PHYSIO"), (req, res) => respond(req, res, false));
programReports.get(["/group", "/group.xlsx"], requireRole("PHYSIO"), (req, res) => respond(req, res, true));
