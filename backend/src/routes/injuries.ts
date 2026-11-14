import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

export const injuriesRouter = Router();
injuriesRouter.use(requireAuth);

const DAY = 24 * 60 * 60 * 1000;

const injurySchema = z.object({
  isHistory: z.boolean().default(false),
  bodyZone: z.string().trim().min(2, "Elige la zona").max(60),
  injuryType: z.string().trim().max(80).optional(),
  intensity: z.number().int().min(0).max(10).optional(),
  whenOccurs: z.string().trim().max(80).optional(),
  mechanism: z.string().trim().max(200).optional(),
  limitation: z.enum(["NONE", "PARTIAL", "FULL"]).default("NONE"),
  daysAbsent: z.number().int().min(0, "Días no válidos").max(3650, "Días no válidos").optional(),
  recurrent: z.boolean().default(false),
  occurredAt: z.coerce
    .date()
    .refine((d) => d.getTime() <= Date.now() + DAY, "La fecha no puede ser futura")
    .optional(),
  notes: z.string().trim().max(1000, "Máximo 1000 caracteres").optional(),
});

// Módulo 2: el deportista reporta una molestia o un antecedente
injuriesRouter.post("/", requireRole("ATHLETE"), async (req, res) => {
  const parsed = injurySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Revisa los datos" });

  const athlete = await prisma.athlete.findUniqueOrThrow({ where: { userId: req.user!.sub } });
  const injury = await prisma.injury.create({ data: { ...parsed.data, athleteId: athlete.id } });

  // Alerta automática si supera el umbral. La regla de la zona manda sobre la general.
  if (!injury.isHistory && injury.intensity != null) {
    const rules = await prisma.alertRule.findMany({
      where: { OR: [{ bodyZone: null }, { bodyZone: injury.bodyZone }] },
    });
    const rule = rules.find((r) => r.bodyZone === injury.bodyZone) ?? rules.find((r) => r.bodyZone === null);
    if (rule && injury.intensity >= rule.minIntensity) {
      await prisma.alert.create({ data: { injuryId: injury.id } });
    }
  }
  res.status(201).json(injury);
});

// El deportista consulta su propio historial
injuriesRouter.get("/mine", requireRole("ATHLETE"), async (req, res) => {
  const athlete = await prisma.athlete.findUniqueOrThrow({ where: { userId: req.user!.sub } });
  const injuries = await prisma.injury.findMany({
    where: { athleteId: athlete.id },
    orderBy: { occurredAt: "desc" },
  });
  res.json(injuries);
});

// Los antecedentes se pueden eliminar siempre. Un reporte solo en las primeras 24 horas,
// para no alterar lo que el equipo ya vio.
injuriesRouter.delete("/:id", requireRole("ATHLETE"), async (req, res) => {
  const athlete = await prisma.athlete.findUniqueOrThrow({ where: { userId: req.user!.sub } });
  const injury = await prisma.injury.findFirst({ where: { id: req.params.id, athleteId: athlete.id } });
  if (!injury) return res.status(404).json({ error: "Registro no encontrado" });
  if (!injury.isHistory && Date.now() - injury.createdAt.getTime() > DAY) {
    return res.status(400).json({ error: "Un reporte solo se puede eliminar durante las primeras 24 horas" });
  }
  await prisma.injury.delete({ where: { id: injury.id } });
  res.json({ ok: true });
});