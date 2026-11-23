import type { groupReport, individualReport } from "../program-report";
import { day, format, percent, ReportingWorkbook, timestamp } from "./workbook-design";

type Individual = NonNullable<Awaited<ReturnType<typeof individualReport>>>;
type Group = Awaited<ReturnType<typeof groupReport>>;
const disclaimer = "Resultados descriptivos. No constituyen un diagnóstico ni demuestran por sí solos una reducción del riesgo de lesiones.";
const missingNote = "El guion indica un dato ausente o no calculable. Un cero representa un valor registrado o calculado.";
const labels: Record<string, string> = {
  SCHEDULED: "Inicio previsto", ACTIVE: "En curso", PERIOD_ENDED: "Periodo previsto terminado",
  INITIAL: "Inicial", FINAL: "Final",
  NEW: "Nueva", IN_REVIEW: "En revisión", REVIEWED: "Revisión registrada", FOLLOW_UP_PENDING: "Seguimiento pendiente",
  START: "Inicio de revisión", REVIEW: "Revisión", REOPEN: "Reapertura",
  NONE: "Sin fatiga", MILD: "Leve", MODERATE: "Moderada", HIGH: "Alta", VERY_HIGH: "Muy alta",
  VERY_GOOD: "Muy buena", GOOD: "Buena", FAIR: "Intermedia", LOW: "Baja", VERY_LOW: "Muy baja",
};
const label = (value: string | null) => value === null ? null : labels[value] ?? value;

export function buildProgramWorkbook(data: Individual | Group) {
  const report = data.report;
  if (!report) throw new Error("El informe debe estar disponible antes de generar un archivo.");
  if ("intervention" in report) {
    const design = new ReportingWorkbook("Individual · Uso autorizado", "Informe individual", data.generatedAt);
    const p = report.participation;
    const d = report.discomfort;
    const paired = report.evaluations.filter(item => item.changes.length > 0).length;
    design.executive("Resumen ejecutivo", [
      ["Programa", report.intervention.name], ["Intervención", report.intervention.programId + " / " + report.intervention.start],
      ["Inicio del periodo", day(report.intervention.start), format.date], ["Corte analizado", day(report.through), format.date],
      ["Término previsto", day(report.plannedEnd), format.date], ["Estado", label(report.status)],
      ["Generado (Bogotá)", timestamp(data.generatedAt), format.timestamp],
    ], [
      ["Sesiones previstas", p?.planned ?? null], ["Completadas al corte", p?.completed ?? null],
      ["Adherencia al corte", percent(p?.adherence), format.percent],
      ["Instrumentos con par", paired], ["Días con bienestar", report.wellbeing.length], ["Registros de molestias", d?.reports.length ?? null],
    ], [
      p ? `${p.completed} de ${p.plannedToDate} sesiones previstas al corte. ${p.pending} pendientes y ${p.weeksWithRecords} semanas con registros.`
        : "Participación sin cálculo para el ciclo seleccionado.",
      report.descriptiveNote,
      disclaimer,
    ]);

    design.table("Evaluaciones funcionales", [
      ["Instrumento", 17], ["Medición", 22], ["Fecha inicial", 14, format.date], ["Valor inicial", 12, format.number],
      ["Fecha final", 14, format.date], ["Valor final", 12, format.number], ["Unidad", 8],
      ["Diferencia", 12, format.number], ["Cambio (%)", 12, format.percent], ["Comparabilidad", 23],
    ], report.evaluations.flatMap(item => {
      const initial = item.records.filter(row => row.phase === "INITIAL" && row.inWindow);
      const final = item.records.filter(row => row.phase === "FINAL" && row.inWindow);
      return item.changes.length
        ? item.changes.map(row => [item.name, row.key, day(initial[0]?.day), row.initial, day(final[0]?.day),
          row.final, item.unit, row.absolute, percent(row.percentage), "Comparable"])
        : [[item.name, null, initial.length === 1 ? day(initial[0].day) : null, null,
          final.length === 1 ? day(final[0].day) : null, null, item.unit, null, null, "Sin par comparable"]];
    }), "Mediciones comparables en sus unidades originales. Las diferencias se presentan en formato neutral.");

    if (p) {
      const rows = p.rows.map(row => [row.week, row.planned, row.completed, row.completed > 0 ? "Con registro" : "Sin registro"]);
      const adherence = design.table("Adherencia", [
        ["Semana o corte", 25], ["Previstas", 15], ["Completadas", 17], ["Disponibilidad", 22], ["Adherencia", 16, format.percent],
      ], [...rows, ["Total al corte", p.plannedToDate, p.completed, `${p.weeksWithRecords} semanas con registros`, percent(p.adherence)]],
      "Las barras muestran completadas frente al máximo semanal previsto. El porcentaje corresponde al corte del informe.", true);
      design.progress(adherence, "C", rows.length, Math.max(0, ...p.rows.map(row => row.planned)));
    }
    if (d?.reports.length) {
      design.table("Molestias y seguimiento", [
        ["Fecha", 15, format.date], ["Zona", 24], ["Estado actual", 24], ["Fecha de actuación", 18, format.date],
        ["Actuación", 21], ["Estado de la actuación", 24],
      ], d.reports.flatMap(row => row.alerts.length ? row.alerts.flatMap(alert => alert.events.length
        ? alert.events.map(event => [day(row.day), row.zone, label(alert.status), day(event.day), label(event.kind), label(event.status)])
        : [[day(row.day), row.zone, label(alert.status)]]) : [[day(row.day), row.zone, "Sin alerta registrada"]]),
      "Estados y fechas documentados. Varias actuaciones pueden corresponder al mismo reporte.");
    }
    if (report.wellbeing.length) {
      design.table("Bienestar", [["Fecha", 17, format.date], ["Sueño (h)", 16, format.number], ["Fatiga", 24], ["Recuperación", 24]],
        report.wellbeing.map(row => [day(row.day), row.sleepHours, label(row.fatigue), label(row.recovery)]),
        `${report.wellbeing.length} días registrados. ${report.wellbeing.filter(row => row.sleepHours !== null).length} con horas de sueño.`);
    }
    const measurements = report.evaluations.flatMap(item => item.records.flatMap(row =>
      (row.values.length ? row.values : [{ key: null, value: null }]).map(value =>
        [item.name, label(row.phase), day(row.day), row.version, row.protocol, value.key, value.value, item.unit])));
    if (measurements.length) {
      design.table("Trazabilidad", [
        ["Instrumento", 17], ["Fase", 13], ["Fecha", 15, format.date], ["Revisión", 11],
        ["Procedimiento", 21], ["Medición", 24], ["Valor", 13, format.number], ["Unidad", 9],
      ], measurements, "Revisiones vigentes del ciclo. Esta hoja también contiene mediciones que quedaron fuera de la comparación.");
    }
    if (report.surveys) {
      const s = report.surveys;
      design.table("Encuestas", [
        ["Fase", 16], ["Estado", 23], ["Presentación (Bogotá)", 24, format.timestamp],
        ["Desde", 16, format.date], ["Hasta", 16, format.date],
      ], ([["Inicial", s.initial], ["Final", s.final]] as const).map(([phase, row]) =>
        [phase, row.submitted ? "Presentada" : "Pendiente", timestamp(row.submitted), day(row.reference?.from), day(row.reference?.to)]),
      "Instrumento de demostración. Se muestran presentaciones con autorización vigente.");
      if (s.comparisons.length) {
        design.table("Respuestas comparables", [["Pregunta", 47], ["Inicial", 27], ["Final", 27]],
          s.comparisons.map(row => [row.question, row.initial, row.final]), "Opciones nominales de preguntas compatibles.");
      }
    }
    design.table("Metodología y definiciones", [["Indicador", 24], ["Definición y fuente", 67]], [
      ["Participación", report.denominatorDefinition],
      ["Adherencia (%)", "Completadas divididas por previstas al corte. No calculable con denominador cero o historial insuficiente."],
      ["Evaluaciones funcionales", "Revisión vigente de la misma intervención. Se exige un par de fases, unidad, instrumento y procedimiento compatibles."],
      ["Cambios", "Diferencia = final menos inicial. Cambio porcentual = diferencia dividida por inicial, con base positiva."],
      ["Molestias", "Reportes registrados en el intervalo del ciclo. Con ciclos solapados se omite la atribución por fecha."],
      ["Bienestar", "Revisión vigente de cada día. Sueño en horas. Fatiga y recuperación se conservan como categorías."],
      ["Encuestas", "Presentaciones compatibles del instrumento de demostración. Aplican elegibilidad y consentimiento vigente."],
      ["Término previsto", "Inicio más duración del programa. El sistema carece de confirmación formal de cierre."],
    ], missingNote + " " + disclaimer);
    return design.book;
  }

  const design = new ReportingWorkbook("Grupal · Demostración sintética", "Informe grupal", data.generatedAt);
  design.executive("Resumen grupal", [
    ["Programa", report.program], ["Periodo", "Ciclos iniciados hasta el corte"],
    ["Corte analizado", day(report.through), format.date], ["Generado (Bogotá)", timestamp(data.generatedAt), format.timestamp],
  ], [
    ["Ciclos incluidos", report.athletes], ["Sesiones completadas", report.completed],
    ["Adherencia conjunta", percent(report.adherence), format.percent],
    ["Evaluación inicial / final", `${report.initial} / ${report.final}`],
    ["Con datos de bienestar", report.wellbeingCoverage], ["Registros de molestias", report.discomfort],
  ], [
    `Cohorte de ${report.athletes} deportistas con inicio y atención documentada. ${report.completed} de ${report.planned} sesiones previstas al corte.`,
    `Adherencia calculable en ${report.calculable} ciclos. Molestias contabilizadas en ${report.unambiguous} ciclos sin solapamiento conocido.`,
    disclaimer,
  ]);
  design.table("Participación y adherencia", [["Indicador", 34], ["Cantidad", 14], ["Denominador", 18], ["Proporción", 15, format.percent]], [
    ["Intervenciones activas", report.active, report.athletes],
    ["Periodo previsto terminado", report.ended, report.athletes],
    ["Sesiones completadas al corte", report.completed, report.planned, percent(report.adherence)],
    ["Ciclos con adherencia calculable", report.calculable, report.athletes],
    ["Registros de molestias", report.discomfort, report.unambiguous],
    ["Deportistas con registros de bienestar", report.wellbeingCoverage, report.athletes],
  ], "El denominador identifica la cohorte, las sesiones previstas o los ciclos atribuibles según la fila.");
  design.table("Cobertura de evaluaciones", [["Indicador", 40], ["Cantidad", 15], ["Base de referencia", 28]], [
    ["Deportistas con evaluación inicial", report.initial, report.athletes],
    ["Deportistas con evaluación final", report.final, report.athletes],
    ["Pares comparables por instrumento y persona", report.comparable, "Conteo de pares"],
  ], "Cobertura agregada de los instrumentos registrados. El informe autorizado no ofrece desglose por instrumento.");
  design.table("Metodología", [["Indicador", 24], ["Definición y fuente", 67]], [
    ["Población", "Deportistas con inicio al corte y atención documentada por fisioterapia. Demostración sintética aislada."],
    ["Adherencia conjunta", report.denominatorDefinition + " Se dividen las completadas entre las previstas al corte."],
    ["Evaluaciones", "La cobertura cuenta deportistas con al menos una medición elegible por fase. Los pares cuentan por instrumento y persona."],
    ["Molestias", "Recuento de registros en ciclos sin solapamiento conocido."],
    ["Bienestar", "Cobertura de deportistas con registros en el ciclo."],
    ["Divulgación", "Los agregados con datos reales requieren una política institucional aprobada."],
  ], missingNote + " " + disclaimer);
  return design.book;
}
