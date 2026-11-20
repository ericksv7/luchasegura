import { listOwnEvaluations } from "./functional-evaluations";
import { isMinorOn } from "../services/consent";
import { calendarDay } from "../services/program";
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

athletesRouter.get("/me/evaluations", requireRole("ATHLETE"), listOwnEvaluations);

const profileSchema = z.object({
  birthDate: z.string().date().transform(date => new Date(date))
    .refine((d) => d.toISOString().slice(0, 10) <= calendarDay(new Date()), "La fecha de nacimiento no puede ser futura")
    .refine((d) => d >= new Date("1940-01-01"), "La fecha de nacimiento no es válida")
    .optional(),
  weightKg: z.number().min(25, "Peso no válido").max(200, "Peso no válido").nullable().optional(),
  category: z.string().trim().max(40).nullable().optional(),
  style: z.enum(["Libre", "Grecorromana", "Femenina"]).nullable().optional(),
  yearsExperience: z.number().int().min(0, "Años no válidos").max(50, "Años no válidos").nullable().optional(),
  notes: z.string().trim().max(1000, "Máximo 1000 caracteres").nullable().optional(),
}).strict();

athletesRouter.put("/me", requireRole("ATHLETE"), async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Revisa los datos" });
  const userId = req.user!.sub;
  const { birthDate, ...fields } = parsed.data;
  const current = birthDate
    ? await prisma.athlete.findUnique({ where: { userId }, select: { birthDate: true } })
    : null;
  if (birthDate && !current) return res.status(404).json({ error: "Perfil no encontrado" });
  const changesDate = birthDate && birthDate.getTime() !== current?.birthDate?.getTime();
  if (changesDate && (isMinorOn(birthDate) || (current?.birthDate && isMinorOn(current.birthDate)))) {
    return res.status(409).json({
      error: "La corrección de una fecha de nacimiento que involucra a un menor requiere revisión del equipo responsable.",
      code: "BIRTH_DATE_REVIEW_REQUIRED",
    });
  }
  const [athlete] = await prisma.athlete.updateManyAndReturn({
    where: { userId, ...(current ? { birthDate: current.birthDate } : {}) },
    data: { ...fields, birthDate: changesDate ? birthDate : undefined },
  });
  if (!athlete && current) return res.status(409).json({ error: "La ficha cambió. Actualízala antes de guardar." });
  if (!athlete) return res.status(404).json({ error: "Perfil no encontrado" });
  res.json(athlete);
});

// Entrenador y fisioterapeuta: lista de deportistas (el entrenador solo ve los suyos)
athletesRouter.get("/", requireRole("COACH", "PHYSIO"), async (req, res) => {
  const where = req.user!.role === "COACH" ? { coachId: req.user!.sub } : {};
  const athletes = await prisma.athlete.findMany({
    where,
    include: { user: { select: { fullName: true, email: true } } },
    ...(req.user!.role === "COACH" ? { omit: { notes: true } } : {}),
  });
  res.json(athletes);
});
