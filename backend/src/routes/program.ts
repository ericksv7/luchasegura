import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

import { currentWeek, loadProgram, presentProgram } from "../services/program";

export const programRouter = Router();
programRouter.use(requireAuth, requireRole("ATHLETE"));

programRouter.get("/current", async (req, res) => {
  const athlete = await prisma.athlete.findUnique({ where: { userId: req.user!.sub } });
  if (!athlete) return res.status(404).json({ error: "Perfil no encontrado" });

  const program = await loadProgram();
  if (!program) return res.json(null);

  const done = await prisma.completedSession.findMany({
    where: { athleteId: athlete.id },
    select: { sessionId: true },
  });
  const doneIds = new Set(done.map((d) => d.sessionId));

  res.json(presentProgram(program, athlete.programStartedAt, doneIds));
});

const sessionUpdate = z.object({ done: z.boolean().optional() });

// Acepta el estado deseado para que un reintento no invierta el resultado.

programRouter.post("/sessions/:id/toggle", async (req, res) => {
  const athlete = await prisma.athlete.findUnique({ where: { userId: req.user!.sub } });
  if (!athlete) return res.status(404).json({ error: "Perfil no encontrado" });

  const parsed = sessionUpdate.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Estado de sesión inválido" });

  const session = await prisma.programSession.findUnique({
    where: { id: req.params.id },
    include: { program: true },
  });
  if (!session) return res.status(404).json({ error: "Sesión no encontrada" });
  if (session.week > currentWeek(athlete.programStartedAt, session.program.weeks)) {
    return res.status(400).json({ error: "Esta sesión todavía no está disponible" });
  }

  const key = { athleteId: athlete.id, sessionId: session.id };
  const done = parsed.data.done ?? !(await prisma.completedSession.findUnique({
    where: { athleteId_sessionId: key },
  }));
  if (done) {
    await prisma.completedSession.createMany({ data: key, skipDuplicates: true });
  } else {
    await prisma.completedSession.deleteMany({ where: key });
  }
  res.json({ done });
});