import { Router } from "express";
import { AlertStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { presentHistoryDate } from "../services/injury-date";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

import { ALERT_FILTERS, alertStatusFilter, PENDING_ALERTS } from "../services/alert-status";
export const alertReviewsRouter = Router();
alertReviewsRouter.use(requireAuth, requireRole("PHYSIO"));
// Ninguna respuesta de este módulo debe almacenarse en cachés compartidas.
alertReviewsRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

const optionalText = z.string().trim().max(4000).default("");
const base = { requestId: z.string().uuid(), expectedVersion: z.number().int().nonnegative() };
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => {
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}, "Fecha de seguimiento inválida");
export const reviewInput = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("START") }).strict(),
  z.object({ ...base, kind: z.literal("REOPEN"), observations: z.string().trim().min(2).max(4000) }).strict(),
  z.object({
    ...base, kind: z.literal("REVIEW"), observations: z.string().trim().min(2).max(4000),
    findings: optionalText, actionTaken: z.string().trim().min(2).max(4000),
    recommendations: optionalText, referral: optionalText,
    followUpRequired: z.boolean(), followUpDate: day.nullable().default(null),
  }).strict(),
]).refine((v) => v.kind !== "REVIEW" || v.followUpRequired || v.followUpDate === null,
  "Marca la necesidad de seguimiento antes de indicar una fecha");

const listInput = z.object({
  athleteId: z.string().uuid().optional(),
  status: z.enum(ALERT_FILTERS).default("PENDING"),
});

alertReviewsRouter.get("/", async (req, res) => {
  const parsed = listInput.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Filtro inválido" });
  const { athleteId, status } = parsed.data;
  const alerts = await prisma.alert.findMany({
    where: {
      ...(athleteId ? { injury: { athleteId } } : {}),
      ...alertStatusFilter(status),
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    include: {
      injury: { include: { athlete: { select: { user: { select: { fullName: true } } } } } },
      entries: { where: { kind: "REVIEW" }, orderBy: { version: "desc" }, take: 1, select: { followUpDate: true } },
    },
  });
  res.json(alerts.map((a) => ({
    id: a.id, status: a.status, createdAt: a.createdAt,
    athleteId: a.injury.athleteId, athleteName: a.injury.athlete.user.fullName,
    zone: a.injury.bodyZone, intensity: a.injury.intensity, limitation: a.injury.limitation,
    whenOccurs: a.injury.whenOccurs, occurredAt: a.injury.occurredAt,
    followUpDate: a.status === "FOLLOW_UP_PENDING" ? a.entries[0]?.followUpDate ?? null : null,
  })));
});

alertReviewsRouter.get("/counts", async (req, res) => {
  const parsed = listInput.pick({ athleteId: true }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Filtro inválido" });
  const athleteId = parsed.data.athleteId;
  const groups = await prisma.alert.groupBy({
    by: ["status"], where: athleteId ? { injury: { athleteId } } : {}, _count: { _all: true },
  });
  const count = (status: AlertStatus) => groups.find(group => group.status === status)?._count._all ?? 0;
  res.json({ pending: PENDING_ALERTS.reduce((sum, status) => sum + count(status), 0), followUps: count("FOLLOW_UP_PENDING"),
    reviewed: count("REVIEWED"), total: groups.reduce((total, group) => total + group._count._all, 0) });
});

alertReviewsRouter.get("/:id", async (req, res) => {
  const alert = await prisma.alert.findUnique({
    where: { id: req.params.id },
    include: {
      entries: { orderBy: { version: "asc" } },
      injury: { include: { athlete: { select: {
        id: true, user: { select: { fullName: true } },
        injuries: { orderBy: { occurredAt: "desc" }, include: {
          alerts: { include: { entries: { orderBy: { version: "asc" } } } },
        } },
      } } } },
    },
  });
  if (!alert) return res.status(404).json({ error: "Alerta no encontrada" });
  const { injury, ...state } = alert;
  const { athlete, ...report } = injury;
  res.json({
    alert: state, report: presentHistoryDate(report), athlete: { id: athlete.id, name: athlete.user.fullName },
    history: athlete.injuries.filter((i) => i.id !== injury.id).map(presentHistoryDate),
  });
});

class Conflict extends Error {}

alertReviewsRouter.post("/:id/review", async (req, res) => {
  const parsed = reviewInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Revisa los datos" });
  const input = parsed.data;
  const alertId = req.params.id;
  const authorId = req.user!.sub;
  const clinical = input.kind === "REVIEW" ? {
    observations: input.observations, findings: input.findings || null, actionTaken: input.actionTaken,
    recommendations: input.recommendations || null, referral: input.referral || null,
    followUpRequired: input.followUpRequired,
    followUpDate: input.followUpDate ? new Date(`${input.followUpDate}T00:00:00.000Z`) : null,
  } : {
    observations: input.kind === "REOPEN" ? input.observations : "Inicio de revisión",
    findings: null, actionTaken: null, recommendations: null, referral: null,
    followUpRequired: false, followUpDate: null,
  };
  const replay = async () => {
    const entry = await prisma.alertEntry.findUnique({ where: { alertId_requestId: { alertId, requestId: input.requestId } } });
    if (!entry) return null;
    // Reintentar una petición es seguro; reutilizar su clave con otro contenido no lo es.
    const same = entry.authorId === authorId && entry.kind === input.kind && entry.version === input.expectedVersion + 1 &&
      Object.entries(clinical).every(([key, value]) => {
        const saved = entry[key as keyof typeof clinical];
        return saved instanceof Date && value instanceof Date ? +saved === +value : saved === value;
      });
    if (!same) throw new Conflict("La clave de envío ya se utilizó con otros datos");
    return entry;
  };
  try {
    const existing = await replay();
    if (existing) return res.json(existing);
    const entry = await prisma.$transaction(async (tx) => {
      const alert = await tx.alert.findUnique({ where: { id: alertId } });
      if (!alert) return null;
      if (alert.version !== input.expectedVersion) throw new Conflict("La alerta cambió. Actualiza sus datos antes de guardar");
      let next: AlertStatus;
      if (input.kind === "REOPEN") {
        if (alert.status !== "REVIEWED") throw new Conflict("Solo se puede reabrir una revisión registrada");
        next = "IN_REVIEW";
      } else if (input.kind === "START") {
        if (alert.status !== "NEW" && alert.status !== "FOLLOW_UP_PENDING") throw new Conflict("La alerta ya está en revisión o tiene una revisión registrada");
        next = alert.status === "FOLLOW_UP_PENDING" ? "FOLLOW_UP_PENDING" : "IN_REVIEW";
      } else {
        if (alert.status === "REVIEWED") throw new Conflict("Reabre la alerta antes de registrar otra revisión");
        next = input.followUpRequired ? "FOLLOW_UP_PENDING" : "REVIEWED";
      }
      const changed = await tx.alert.updateMany({
        where: { id: alertId, version: input.expectedVersion },
        data: { status: next, version: { increment: 1 } },
      });
      if (!changed.count) throw new Conflict("La alerta cambió. Actualiza sus datos antes de guardar");
      const author = await tx.user.findUniqueOrThrow({ where: { id: authorId }, select: { fullName: true } });
      return tx.alertEntry.create({ data: {
        alertId, authorId, authorName: author.fullName, requestId: input.requestId,
        version: alert.version + 1, kind: input.kind, previousStatus: alert.status, status: next, ...clinical,
      } });
    });
    if (!entry) return res.status(404).json({ error: "Alerta no encontrada" });
    res.status(201).json(entry);
  } catch (error) {
    if (error instanceof Conflict || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
      try {
        const existing = await replay();
        if (existing) return res.json(existing);
      } catch { /* clave ya utilizada con contenido diferente */ }
      return res.status(409).json({ error: error instanceof Conflict ? error.message : "La alerta cambió. Actualiza sus datos" });
    }
    throw error;
  }
});
