import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { calendarDay } from "../services/program";
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
  occurredAt: z.string().datetime({ offset: true }).or(z.string().date())
    .refine(value => value.slice(0, 10) <= calendarDay(new Date()), "La fecha no puede ser futura")
    .transform(value => new Date(value))
    .optional(),
  notes: z.string().trim().max(1000, "Máximo 1000 caracteres").optional(),
});

const alertSummary = { select: { id: true, status: true, _count: { select: { entries: true } } } } satisfies Prisma.AlertFindManyArgs;
type InjuryWithAlerts = Prisma.InjuryGetPayload<{ include: { alerts: typeof alertSummary } }>;
const presentInjury = ({ alerts, ...record }: InjuryWithAlerts) => ({
  ...record,
  alerts: alerts.map(({ _count, ...alert }) => ({ ...alert, hasReview: _count.entries > 0 })),
});

// Módulo 2: el deportista reporta una molestia o un antecedente
injuriesRouter.post("/", requireRole("ATHLETE"), async (req, res) => {
  const parsed = injurySchema.extend({ requestId: z.string().uuid().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Revisa los datos" });

  const { requestId, ...fields } = parsed.data;
  const athlete = await prisma.athlete.findUnique({ where: { userId: req.user!.sub }, select: { id: true } });
  if (!athlete) return res.status(404).json({ error: "Perfil no encontrado" });

  try {
    const injury = await prisma.$transaction(async tx => {
      const record = await tx.injury.create({ data: { ...fields, id: requestId, athleteId: athlete.id } });
      const alerts: InjuryWithAlerts["alerts"] = [];
      if (!record.isHistory && record.intensity !== null) {
        const rules = await tx.alertRule.findMany({
          where: { OR: [{ bodyZone: null }, { bodyZone: record.bodyZone }] },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        });
        const rule = rules.find(r => r.bodyZone === record.bodyZone) ?? rules.find(r => r.bodyZone === null);
        if (rule && record.intensity >= rule.minIntensity) {
          alerts.push(await tx.alert.create({ data: { injuryId: record.id }, select: alertSummary.select }));
        }
      }
      return { ...record, alerts };
    });
    res.status(201).json(presentInjury(injury));
  } catch (error) {
    if (requestId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const record = await prisma.injury.findFirst({
        where: { id: requestId, athleteId: athlete.id }, include: { alerts: alertSummary },
      });
      const entries = Object.entries(fields) as [keyof typeof fields, unknown][];
      if (record && entries.every(([key, value]) => {
        const saved = record[key];
        return value instanceof Date && saved instanceof Date ? value.getTime() === saved.getTime() : value === saved;
      }) && ['injuryType', 'intensity', 'whenOccurs', 'mechanism', 'daysAbsent', 'notes'].every(key =>
        Object.hasOwn(fields, key) || record[key as keyof typeof record] === null
      )) return res.json(presentInjury(record));

      return res.status(409).json({ error: "El envío ya se utilizó para otro registro" });
    }
    throw error;
  }
});

const historyEdit = injurySchema.pick({ bodyZone: true, injuryType: true, occurredAt: true, daysAbsent: true, recurrent: true })
  .extend({ injuryType: injurySchema.shape.injuryType.nullable(), daysAbsent: injurySchema.shape.daysAbsent.nullable() }).strict();

injuriesRouter.patch("/:id/history", requireRole("ATHLETE"), async (req, res) => {
  const parsed = historyEdit.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Revisa los datos" });
  const [updated] = await prisma.injury.updateManyAndReturn({
    where: { id: req.params.id, isHistory: true, athlete: { userId: req.user!.sub }, alerts: { none: {} } },
    data: parsed.data,
  });
  if (!updated) return res.status(404).json({ error: "Antecedente editable no encontrado" });
  res.json(updated);
});

// El deportista consulta su propio historial
injuriesRouter.get("/mine", requireRole("ATHLETE"), async (req, res) => {
  const athlete = await prisma.athlete.findUniqueOrThrow({ where: { userId: req.user!.sub } });
  const injuries = await prisma.injury.findMany({
    where: { athleteId: athlete.id },
    orderBy: { occurredAt: "desc" },
    include: { alerts: alertSummary },
  });
  res.json(injuries.map(presentInjury));
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
  try {
    await prisma.injury.delete({ where: { id: injury.id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return res.status(409).json({ error: "El reporte ya tiene seguimiento profesional y no se puede eliminar" });
    }
    throw error;
  }
  res.json({ ok: true });
});