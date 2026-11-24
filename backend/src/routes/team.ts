import { injuryCharacterizations } from "./injury-characterizations";
import { teamSleep } from "./sleep";
import { createEvaluation, editEvaluation, listEvaluationRevisions, listTeamEvaluations } from "./functional-evaluations";
import { teamWellbeing } from "./wellbeing";
import { Request, Router } from "express";
import { Prisma } from "@prisma/client";
import { presentHistoryDate } from "../services/injury-date";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { calendarDay, loadProgram, presentProgram, progress } from "../services/program";
import { z } from "zod";
import { PENDING_ALERTS } from "../services/alert-status";
import { exportTeamReport } from "./team-export";

export const teamRouter = Router();
teamRouter.use(requireAuth, requireRole("COACH", "PHYSIO"));
teamRouter.use("/athletes/:id/wellbeing", requireRole("PHYSIO"), teamWellbeing);
teamRouter.use("/athletes/:id/sleep", teamSleep);
teamRouter.use("/athletes/:id/injuries/:injuryId/characterization", requireRole("PHYSIO"), injuryCharacterizations);

// Borrador: el porcentaje mínimo de cumplimiento lo define el fisioterapeuta
const LOW_ADHERENCE = 60;

// El entrenador solo ve a sus deportistas; el fisioterapeuta ve a todos
function scopeOf(req: Request): Prisma.AthleteWhereInput {
  return req.user!.role === "COACH" ? { coachId: req.user!.sub } : {};
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
    followUpDate: a.status === "FOLLOW_UP_PENDING" ? a.entries[0]?.followUpDate ?? null : null,
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

teamRouter.get("/athletes/:id/evaluations", requireRole("PHYSIO"), listTeamEvaluations);
teamRouter.post("/athletes/:id/evaluations", requireRole("PHYSIO"), createEvaluation);
teamRouter.patch("/athletes/:id/evaluations/:testId", requireRole("PHYSIO"), editEvaluation);
teamRouter.get("/athletes/:id/evaluations/:testId/revisions", requireRole("PHYSIO"), listEvaluationRevisions);

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
    injuries: isPhysio ? a.injuries.map(presentHistoryDate) : a.injuries.filter(i => !i.isHistory).map(i => ({
      id: i.id, isHistory: false, occurredAt: i.occurredAt, createdAt: i.createdAt,
      bodyZone: i.bodyZone, intensity: i.intensity, limitation: i.limitation, alerts: i.alerts,
      notes: null, mechanism: null, injuryType: null, whenOccurs: null, daysAbsent: null, recurrent: false,
    })),
  });
});

teamRouter.get("/export", requireRole("PHYSIO"), exportTeamReport);
