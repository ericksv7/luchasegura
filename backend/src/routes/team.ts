import { Request, Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { currentWeek, calendarDay, loadProgram, presentProgram } from "../services/program";
import { z } from "zod";
import ExcelJS from "exceljs";
import { PENDING_ALERTS } from "./alert-reviews";

export const teamRouter = Router();
teamRouter.use(requireAuth, requireRole("COACH", "PHYSIO"));

// Borrador: el porcentaje mínimo de cumplimiento lo define el fisioterapeuta
const LOW_ADHERENCE = 60;

// El entrenador solo ve a sus deportistas; el fisioterapeuta ve a todos
function scopeOf(req: Request): Prisma.AthleteWhereInput {
  return req.user!.role === "COACH" ? { coachId: req.user!.sub } : {};
}

type ProgramLite = { weeks: number; sessions: { id: string; week: number }[] } | null;

function progress(program: ProgramLite, startedAt: Date | null, doneIds: Set<string>) {
  if (!program) return { week: 0, planned: 0, done: 0, compliance: 0 };
  const week = currentWeek(startedAt, program.weeks);
  const upto = program.sessions.filter((s) => s.week <= week);
  const done = upto.filter((s) => doneIds.has(s.id)).length;
  return {
    week,
    planned: upto.length,
    done,
    compliance: upto.length ? Math.round((done / upto.length) * 100) : 0,
  };
}

teamRouter.get("/overview", async (req, res) => {
  const scope = scopeOf(req);
  const program = await loadProgram();

  const athletes = await prisma.athlete.findMany({
    where: scope,
    orderBy: { user: { fullName: "asc" } },
    include: {
      user: { select: { fullName: true, email: true } },
      completed: { select: { sessionId: true } },
      injuries: { where: { isHistory: false }, orderBy: { occurredAt: "desc" }, take: 1 },
    },
  });

  const alerts = await prisma.alert.findMany({
    where: { status: { in: [...PENDING_ALERTS, "FOLLOW_UP_PENDING"] }, injury: { athlete: scope } },
    orderBy: { createdAt: "desc" },
    include: {
      entries: { where: { kind: "REVIEW" }, orderBy: { version: "desc" }, take: 1, select: { followUpDate: true } },
      injury: { include: { athlete: { include: { user: { select: { fullName: true } } } } } },
    },
  });

  const pending = alerts.filter((a) => PENDING_ALERTS.includes(a.status));
  const followUps = alerts.filter((a) => a.status === "FOLLOW_UP_PENDING");
  const newByAthlete = new Map<string, number>();
  const followUpByAthlete = new Map<string, number>();
  for (const a of pending) newByAthlete.set(a.injury.athleteId, (newByAthlete.get(a.injury.athleteId) ?? 0) + 1);
  for (const a of followUps) followUpByAthlete.set(a.injury.athleteId, (followUpByAthlete.get(a.injury.athleteId) ?? 0) + 1);

  const rows = athletes.map((a) => {
    const p = progress(program, a.programStartedAt, new Set(a.completed.map((c) => c.sessionId)));
    const last = a.injuries[0] ?? null;
    return {
      id: a.id,
      name: a.user.fullName,
      email: a.user.email,
      ...p,
      lowAdherence: p.planned > 0 && p.compliance < LOW_ADHERENCE,
      newAlerts: newByAthlete.get(a.id) ?? 0,
      followUpAlerts: followUpByAthlete.get(a.id) ?? 0,
      lastReport: last
        ? { zone: last.bodyZone, intensity: last.intensity, limitation: last.limitation, at: last.occurredAt }
        : null,
    };
  });

  const summarize = (a: typeof alerts[number]) => ({
    id: a.id, version: a.version, status: a.status, createdAt: a.createdAt,
    athleteId: a.injury.athleteId, athleteName: a.injury.athlete.user.fullName,
    zone: a.injury.bodyZone, intensity: a.injury.intensity, limitation: a.injury.limitation,
    whenOccurs: req.user!.role === "PHYSIO" ? a.injury.whenOccurs : null, occurredAt: a.injury.occurredAt,
    followUpDate: a.entries[0]?.followUpDate ?? null,
  });
  const withPlan = rows.filter((r) => r.planned > 0);
  res.json({
    stats: {
      athletes: rows.length,
      avgCompliance: withPlan.length
        ? Math.round(withPlan.reduce((sum, r) => sum + r.compliance, 0) / withPlan.length)
        : 0,
      newAlerts: pending.length,
      followUpAlerts: followUps.length,
      lowAdherence: rows.filter((r) => r.lowAdherence).length,
    },
    athletes: rows,
    alerts: pending.map(summarize),
    followUps: followUps.map(summarize),
  });
});

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.getUTCFullYear() >= 1 && parsed.toISOString().slice(0, 10) === value;
});
const programStart = z.object({ startedAt: day, expectedStartedAt: day.nullable() }).strict();

teamRouter.patch("/athletes/:id/program-start", requireRole("PHYSIO"), async (req, res) => {
  const parsed = programStart.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Indica una fecha de inicio válida y la fecha previamente consultada." });
  const athlete = await prisma.athlete.findFirst({ where: { id: req.params.id, ...scopeOf(req) }, select: { id: true } });
  if (!athlete) return res.status(404).json({ error: "Deportista no encontrado" });
  const { startedAt, expectedStartedAt } = parsed.data;
  try {
    const result = await prisma.$transaction(async tx => {
      const first = await tx.completedSession.findFirst({ where: { athleteId: athlete.id }, orderBy: { doneAt: "asc" }, select: { doneAt: true } });
      if (first && startedAt > calendarDay(first.doneAt)) return "AFTER_COMPLETION";
      const updated = await tx.athlete.updateMany({
        where: { id: athlete.id, programStartedAt: expectedStartedAt ? new Date(expectedStartedAt) : null },
        data: { programStartedAt: new Date(startedAt) },
      });
      return updated.count ? "OK" : "STALE";
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result === "AFTER_COMPLETION") return res.status(400).json({ error: "El inicio no puede ser posterior a una sesión ya completada. Los registros existentes se conservan." });
    if (result === "STALE") return res.status(409).json({ error: "La fecha cambió desde que abriste la ficha. Actualiza la información antes de volver a guardar." });
    res.json({ startedAt });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return res.status(409).json({ error: "La información cambió durante el guardado. Actualiza la ficha e inténtalo de nuevo." });
    throw error;
  }
});

teamRouter.get("/athletes/:id/evaluations", requireRole("PHYSIO"), async (req, res) => {
  const athlete = await prisma.athlete.findFirst({ where: { id: req.params.id, ...scopeOf(req) }, select: { id: true } });
  if (!athlete) return res.status(404).json({ error: "Deportista no encontrado" });
  const tests = await prisma.functionalTest.findMany({
    where: { athleteId: athlete.id }, orderBy: [{ measuredAt: "desc" }, { id: "asc" }],
    select: { id: true, testType: true, phase: true, result: true, measuredAt: true },
  });
  res.json({ protocolStatus: "AWAITING_VALIDATION", dependency: "Precisar con el equipo académico los protocolos de aplicación, unidades y reglas de registro de las pruebas del PDF original antes de habilitar nuevas mediciones.", tests });
});

teamRouter.get("/athletes/:id", async (req, res) => {
  const isPhysio = req.user!.role === "PHYSIO";
  const a = await prisma.athlete.findFirst({
    where: { id: req.params.id, ...scopeOf(req) },
    include: {
      user: { select: { fullName: true, email: true } },
      coach: { select: { fullName: true } },
      completed: { select: { sessionId: true } },
      injuries: { orderBy: { occurredAt: "desc" }, include: { alerts: { select: { id: true, status: true } } } },
    },
  });
  if (!a) return res.status(404).json({ error: "Deportista no encontrado" });

  const program = await loadProgram();
  const doneIds = new Set(a.completed.map((c) => c.sessionId));
  const p = progress(program, a.programStartedAt, doneIds);

  res.json({
    id: a.id,
    name: a.user.fullName,
    email: a.user.email,
    coachName: a.coach?.fullName ?? null,
    profile: {
      birthDate: a.birthDate,
      weightKg: a.weightKg,
      category: a.category,
      style: a.style,
      yearsExperience: a.yearsExperience,
      notes: isPhysio ? a.notes : null,
    },
    program: program
      ? presentProgram(program, a.programStartedAt, doneIds)
      : null,
    compliance: p.compliance,
    planned: p.planned,
    done: p.done,
    weekBars: program
      ? Array.from({ length: program.weeks }, (_, i) => ({
          week: i + 1,
          done: program.sessions.filter((s) => s.week === i + 1 && doneIds.has(s.id)).length,
        }))
      : [],
    injuries: isPhysio ? a.injuries : a.injuries.filter(i => !i.isHistory).map(i => ({
      id: i.id, isHistory: false, occurredAt: i.occurredAt, createdAt: i.createdAt,
      bodyZone: i.bodyZone, intensity: i.intensity, limitation: i.limitation, alerts: i.alerts,
      notes: null, mechanism: null, injuryType: null, whenOccurs: null, daysAbsent: null, recurrent: false,
    })),
  });
});

// ===== Exportar a Excel =====
type Col = { header: string; key: string; width: number; date?: boolean; pii?: boolean };

const LIMIT_ES = { NONE: "No limita", PARTIAL: "Limita parcialmente", FULL: "No puede entrenar" } as const;

function ageOf(d: Date | null): number | null {
  if (!d) return null;
  const n = new Date();
  let a = n.getUTCFullYear() - d.getUTCFullYear();
  if (n.getUTCMonth() < d.getUTCMonth() || (n.getUTCMonth() === d.getUTCMonth() && n.getUTCDate() < d.getUTCDate())) a--;
  return a;
}

function addSheet(wb: ExcelJS.Workbook, name: string, cols: Col[], rows: Record<string, unknown>[], anon: boolean) {
  // En el archivo anónimo se omiten las columnas con datos que identifican a la persona
  const use = cols.filter((c) => !(anon && c.pii));
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = use.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
    style: c.date ? { numFmt: "dd/mm/yyyy" } : {},
  }));
  ws.addRows(rows);
  const head = ws.getRow(1);
  head.font = { bold: true };
  head.alignment = { vertical: "middle" };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: use.length } };
}

teamRouter.get("/export", requireRole("PHYSIO"), async (req, res) => {
  const anon = req.query.anon === "1";
  const program = await loadProgram();

  const athletes = await prisma.athlete.findMany({
    where: scopeOf(req),
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { fullName: true, email: true } },
      coach: { select: { fullName: true } },
      completed: {
        orderBy: { doneAt: "asc" },
        include: { session: { select: { week: true, number: true } } },
      },
      injuries: { orderBy: { occurredAt: "asc" } },
    },
  });

  // En el archivo anónimo, cada deportista es un código
  const who = (i: number, name: string) => (anon ? `D-${String(i + 1).padStart(3, "0")}` : name);

  const wb = new ExcelJS.Workbook();
  wb.creator = "LuchaSegura";
  wb.created = new Date();

  addSheet(
    wb,
    "Deportistas",
    [
      { header: "Deportista", key: "name", width: 26 },
      { header: "Correo", key: "email", width: 30, pii: true },
      { header: "Edad", key: "age", width: 8 },
      { header: "Peso (kg)", key: "weight", width: 11 },
      { header: "Categoría", key: "category", width: 14 },
      { header: "Estilo", key: "style", width: 14 },
      { header: "Años de experiencia", key: "years", width: 20 },
      { header: "Entrenador", key: "coach", width: 24, pii: true },
      { header: "Semana actual", key: "week", width: 14 },
      { header: "Sesiones hechas", key: "done", width: 16 },
      { header: "Sesiones previstas", key: "planned", width: 18 },
      { header: "Cumplimiento (%)", key: "compliance", width: 17 },
      { header: "Molestias reportadas", key: "reports", width: 20 },
      { header: "Antecedentes", key: "history", width: 14 },
    ],
    athletes.map((a, i) => {
      const p = progress(program, a.programStartedAt, new Set(a.completed.map((c) => c.sessionId)));
      return {
        name: who(i, a.user.fullName),
        email: a.user.email,
        age: ageOf(a.birthDate),
        weight: a.weightKg != null ? Number(a.weightKg) : null,
        category: a.category,
        style: a.style,
        years: a.yearsExperience,
        coach: a.coach?.fullName ?? null,
        week: p.week || null,
        done: p.done,
        planned: p.planned,
        compliance: p.compliance,
        reports: a.injuries.filter((x) => !x.isHistory).length,
        history: a.injuries.filter((x) => x.isHistory).length,
      };
    }),
    anon
  );

  addSheet(
    wb,
    "Molestias",
    [
      { header: "Deportista", key: "name", width: 26 },
      { header: "Tipo de registro", key: "kind", width: 16 },
      { header: "Fecha", key: "date", width: 12, date: true },
      { header: "Zona", key: "zone", width: 18 },
      { header: "Tipo de lesión", key: "type", width: 18 },
      { header: "Intensidad (0-10)", key: "pain", width: 17 },
      { header: "Cuándo aparece", key: "when", width: 22 },
      { header: "Limitación", key: "limit", width: 22 },
      { header: "Días sin entrenar", key: "absent", width: 18 },
      { header: "Recurrente", key: "recurrent", width: 12 },
      { header: "Notas", key: "notes", width: 40, pii: true },
    ],
    athletes.flatMap((a, i) =>
      a.injuries.map((x) => ({
        name: who(i, a.user.fullName),
        kind: x.isHistory ? "Antecedente" : "Molestia",
        date: x.occurredAt,
        zone: x.bodyZone,
        type: x.injuryType,
        pain: x.intensity,
        when: x.whenOccurs,
        limit: LIMIT_ES[x.limitation],
        absent: x.daysAbsent,
        recurrent: x.recurrent ? "Sí" : "No",
        notes: x.notes,
      }))
    ),
    anon
  );

  addSheet(
    wb,
    "Sesiones",
    [
      { header: "Deportista", key: "name", width: 26 },
      { header: "Semana", key: "week", width: 10 },
      { header: "Sesión", key: "number", width: 10 },
      { header: "Fecha", key: "date", width: 12, date: true },
    ],
    athletes.flatMap((a, i) =>
      a.completed.map((c) => ({
        name: who(i, a.user.fullName),
        week: c.session.week,
        number: c.session.number,
        date: c.doneAt,
      }))
    ),
    anon
  );

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="luchasegura_${anon ? "anonimo_" : ""}${stamp}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});
