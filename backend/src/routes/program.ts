import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

export const programRouter = Router();
programRouter.use(requireAuth, requireRole("ATHLETE"));

// La semana actual cuenta desde que el deportista se registró
function currentWeek(since: Date, weeks: number) {
  const days = Math.floor((Date.now() - since.getTime()) / 86_400_000);
  return Math.min(weeks, Math.max(1, Math.floor(days / 7) + 1));
}

programRouter.get("/current", async (req, res) => {
  const athlete = await prisma.athlete.findUnique({ where: { userId: req.user!.sub } });
  if (!athlete) return res.status(404).json({ error: "Perfil no encontrado" });

  const program = await prisma.program.findFirst({
    where: { sessions: { some: {} } },
    include: {
      sessions: {
        orderBy: [{ week: "asc" }, { number: "asc" }],
        include: { exercises: { orderBy: { position: "asc" }, include: { exercise: true } } },
      },
    },
  });
  if (!program) return res.json(null);

  const done = await prisma.completedSession.findMany({
    where: { athleteId: athlete.id },
    select: { sessionId: true },
  });
  const doneIds = new Set(done.map((d) => d.sessionId));

  res.json({
    id: program.id,
    name: program.name,
    weeks: program.weeks,
    sessionsPerWeek: program.sessionsPerWeek,
    currentWeek: currentWeek(athlete.createdAt, program.weeks),
    sessions: program.sessions.map((s) => ({
      id: s.id,
      week: s.week,
      number: s.number,
      minutes: s.minutes,
      done: doneIds.has(s.id),
      exercises: s.exercises.map((e) => ({
        name: e.exercise.name,
        component: e.exercise.component,
        dosage: e.exercise.dosage,
        description: e.exercise.description,
      })),
    })),
  });
});

// Marca o desmarca una sesión como completada
programRouter.post("/sessions/:id/toggle", async (req, res) => {
  const athlete = await prisma.athlete.findUnique({ where: { userId: req.user!.sub } });
  if (!athlete) return res.status(404).json({ error: "Perfil no encontrado" });

  const session = await prisma.programSession.findUnique({
    where: { id: req.params.id },
    include: { program: true },
  });
  if (!session) return res.status(404).json({ error: "Sesión no encontrada" });
  if (session.week > currentWeek(athlete.createdAt, session.program.weeks)) {
    return res.status(400).json({ error: "Esta sesión todavía no está disponible" });
  }

  const existing = await prisma.completedSession.findUnique({
    where: { athleteId_sessionId: { athleteId: athlete.id, sessionId: session.id } },
  });
  if (existing) {
    await prisma.completedSession.delete({ where: { id: existing.id } });
    return res.json({ done: false });
  }
  await prisma.completedSession.create({ data: { athleteId: athlete.id, sessionId: session.id } });
  res.json({ done: true });
});