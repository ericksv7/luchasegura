import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

export const rulesRouter = Router();
rulesRouter.use(requireAuth);

rulesRouter.get("/", requireRole("COACH", "PHYSIO"), async (_req, res) => {
  res.json(await prisma.alertRule.findMany({ orderBy: [{ bodyZone: "asc" }] }));
});

const ruleSchema = z.object({
  bodyZone: z.string().trim().min(2).max(60).nullable(),
  minIntensity: z.number().int().min(1, "Elige un valor entre 1 y 10").max(10, "Elige un valor entre 1 y 10"),
});

// Solo el fisioterapeuta define los umbrales. Si ya hay una regla para esa zona, se reemplaza.
rulesRouter.post("/", requireRole("PHYSIO"), async (req, res) => {
  const parsed = ruleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
  const { bodyZone, minIntensity } = parsed.data;

  const existing = await prisma.alertRule.findFirst({ where: { bodyZone } });
  const rule = existing
    ? await prisma.alertRule.update({ where: { id: existing.id }, data: { minIntensity, createdById: req.user!.sub } })
    : await prisma.alertRule.create({ data: { bodyZone, minIntensity, createdById: req.user!.sub } });
  res.status(existing ? 200 : 201).json(rule);
});

rulesRouter.delete("/:id", requireRole("PHYSIO"), async (req, res) => {
  const r = await prisma.alertRule.deleteMany({ where: { id: req.params.id } });
  if (r.count === 0) return res.status(404).json({ error: "Regla no encontrada" });
  res.json({ ok: true });
});