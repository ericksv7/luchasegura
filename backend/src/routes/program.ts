import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

import { currentWeek, loadProgram, loadProgramIdentity, presentProgram } from "../services/program";

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
  const parsed = sessionUpdate.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Estado de sesión inválido" });
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const result = await prisma.$transaction(async tx => {
        const athlete = await tx.athlete.findUnique({
          where: { userId: req.user!.sub }, select: { id: true, programStartedAt: true },
        });
        if (!athlete) return { status: 404, error: "Perfil no encontrado" };

        const program = await loadProgramIdentity(tx);
        if (!program) return { status: 404, error: "Sesión no encontrada en el programa vigente" };
        const session = await tx.programSession.findFirst({
          where: { id: req.params.id, programId: program.id }, select: { id: true, week: true },
        });
        if (!session) return { status: 404, error: "Sesión no encontrada en el programa vigente" };
        if (session.week > currentWeek(athlete.programStartedAt, program.weeks)) {
          return { status: 400, error: "Esta sesión todavía no está disponible" };
        }

        const key = { athleteId: athlete.id, sessionId: session.id };
        const done = parsed.data.done ?? !(await tx.completedSession.findUnique({
          where: { athleteId_sessionId: key },
        }));
        if (done) await tx.completedSession.createMany({ data: key, skipDuplicates: true });
        else await tx.completedSession.deleteMany({ where: key });
        return { done };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if (result.status !== undefined) return res.status(result.status).json({ error: result.error });
      return res.json({ done: result.done });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") throw error;
    }
  }
  res.status(409).json({ error: "El programa cambió durante el guardado. Actualiza la información antes de reintentar." });
});
