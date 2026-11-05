import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

export const athletesRouter = Router();
athletesRouter.use(requireAuth);

// Módulo 1: el deportista ve y edita su propio perfil
athletesRouter.get("/me", requireRole("ATHLETE"), async (req, res) => {
  const athlete = await prisma.athlete.findUnique({ where: { userId: req.user!.sub } });
  res.json(athlete);
});

const profileSchema = z.object({
  birthDate: z.coerce.date().optional(),
  weightKg: z.number().positive().optional(),
  category: z.string().optional(),
  style: z.string().optional(),
  yearsExperience: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

athletesRouter.put("/me", requireRole("ATHLETE"), async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const athlete = await prisma.athlete.update({
    where: { userId: req.user!.sub },
    data: parsed.data,
  });
  res.json(athlete);
});

// Entrenador y fisioterapeuta: lista de deportistas (el entrenador solo ve los suyos)
athletesRouter.get("/", requireRole("COACH", "PHYSIO"), async (req, res) => {
  const where = req.user!.role === "COACH" ? { coachId: req.user!.sub } : {};
  const athletes = await prisma.athlete.findMany({
    where,
    include: { user: { select: { fullName: true, email: true } } },
  });
  res.json(athletes);
});
