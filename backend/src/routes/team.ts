import { Request, Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { currentWeek } from "./program";

export const teamRouter = Router();
teamRouter.use(requireAuth, requireRole("COACH", "PHYSIO"));

// Borrador: el porcentaje mínimo de cumplimiento lo define el fisioterapeuta
const LOW_ADHERENCE = 60;

// El entrenador solo ve a sus deportistas; el fisioterapeuta ve a todos
function scopeOf(req: Request): Prisma.AthleteWhereInput {
  return req.user!.role === "COACH" ? { coachId: req.user!.sub } : {};
}

function loadProgram() {
  return prisma.program.findFirst({
    where: { sessions: { some: {} } },
    include: { sessions: { select: { id: true, week: true } } },
  });
}

type ProgramLite = { weeks: number; sessions: { id: string; week: number }[] } | null;

function progress(program: ProgramLite, createdAt: Date, doneIds: Set<string>) {
  if (!program) return { week: 0, planned: 0, done: 0, compliance: 0 };
  const week = currentWeek(createdAt, program.weeks);
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
    where: { status: "NEW", injury: { athlete: scope } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      injury: { include: { athlete: { include: { user: { select: { fullName: true } } } } } },
    },
  });

  const newByAthlete = new Map<string, number>();
  for (const a of alerts) {
    newByAthlete.set(a.injury.athleteId, (newByAthlete.get(a.injury.athleteId) ?? 0) + 1);
  }

  const rows = athletes.map((a) => {
    const p = progress(program, a.createdAt, new Set(a.completed.map((c) => c.sessionId)));
    const last = a.injuries[0] ?? null;
    return {
      id: a.id,
      name: a.user.fullName,
      email: a.user.email,
      ...p,
      lowAdherence: p.planned > 0 && p.compliance < LOW_ADHERENCE,
      newAlerts: newByAthlete.get(a.id) ?? 0,
      lastReport: last
        ? { zone: last.bodyZone, intensity: last.intensity, limitation: last.limitation, at: last.occurredAt }
        : null,
    };
  });

  const withPlan = rows.filter((r) => r.planned > 0);
  res.json({
    stats: {
      athletes: rows.length,
      avgCompliance: withPlan.length
        ? Math.round(withPlan.reduce((sum, r) => sum + r.compliance, 0) / withPlan.length)
        : 0,
      newAlerts: alerts.length,
      lowAdherence: rows.filter((r) => r.lowAdherence).length,
    },
    athletes: rows,
    alerts: alerts.map((a) => ({
      id: a.id,
      createdAt: a.createdAt,
      athleteId: a.injury.athleteId,
      athleteName: a.injury.athlete.user.fullName,
      zone: a.injury.bodyZone,
      intensity: a.injury.intensity,
      limitation: a.injury.limitation,
      whenOccurs: a.injury.whenOccurs,
      occurredAt: a.injury.occurredAt,
    })),
  });
});

teamRouter.post("/alerts/:id/review", async (req, res) => {
  const r = await prisma.alert.updateMany({
    where: { id: req.params.id, injury: { athlete: scopeOf(req) } },
    data: { status: "REVIEWED" },
  });
  if (r.count === 0) return res.status(404).json({ error: "Alerta no encontrada" });
  res.json({ ok: true });
});

teamRouter.get("/athletes/:id", async (req, res) => {
  const a = await prisma.athlete.findFirst({
    where: { id: req.params.id, ...scopeOf(req) },
    include: {
      user: { select: { fullName: true, email: true } },
      coach: { select: { fullName: true } },
      completed: { select: { sessionId: true } },
      injuries: { orderBy: { occurredAt: "desc" } },
    },
  });
  if (!a) return res.status(404).json({ error: "Deportista no encontrado" });

  const program = await loadProgram();
  const doneIds = new Set(a.completed.map((c) => c.sessionId));
  const p = progress(program, a.createdAt, doneIds);

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
      notes: a.notes,
    },
    program: program
      ? { weeks: program.weeks, sessionsPerWeek: program.sessions.length / program.weeks, currentWeek: p.week }
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
    injuries: a.injuries,
  });
});