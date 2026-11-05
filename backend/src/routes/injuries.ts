import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

export const injuriesRouter = Router();
injuriesRouter.use(requireAuth);

const injurySchema = z.object({
  isHistory: z.boolean().default(false),
  bodyZone: z.string().min(2),
  injuryType: z.string().optional(),
  intensity: z.number().int().min(0).max(10).optional(),
  whenOccurs: z.string().optional(),
  mechanism: z.string().optional(),
  limitation: z.enum(["NONE", "PARTIAL", "FULL"]).default("NONE"),
  daysAbsent: z.number().int().min(0).optional(),
  recurrent: z.boolean().default(false),
  occurredAt: z.coerce.date().optional(),
  notes: z.string().optional(),
});

// Módulo 2: el deportista reporta una molestia o un antecedente
injuriesRouter.post("/", requireRole("ATHLETE"), async (req, res) => {
  const parsed = injurySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const athlete = await prisma.athlete.findUniqueOrThrow({ where: { userId: req.user!.sub } });
  const injury = await prisma.injury.create({ data: { ...parsed.data, athleteId: athlete.id } });

  // Alerta automática si supera el umbral definido por el fisioterapeuta
  if (!injury.isHistory && injury.intensity != null) {
    const rule = await prisma.alertRule.findFirst({
      where: {
        minIntensity: { lte: injury.intensity },
        OR: [{ bodyZone: null }, { bodyZone: injury.bodyZone }],
      },
    });
    if (rule) await prisma.alert.create({ data: { injuryId: injury.id } });
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
