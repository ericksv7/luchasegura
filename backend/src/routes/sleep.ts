import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { config } from "../config";
import { prisma } from "../db";
import { consentEvidence, isMinorOn, registrationNotice } from "../services/consent";
import { documentedWellbeingScope } from "../services/wellbeing-access";

export const ownSleep = Router();
export const teamSleep = Router({ mergeParams: true });

const notice: { version: string; status: "draft" | "approved"; text: string } = {
  version: "sleep-v1-draft",
  status: "draft",
  text: "Autorizo al entrenador que aparece aquí a consultar mis fechas y horas de sueño, incluidas las anteriores, y el periodo del programa al que corresponden. Puedo retirar el acceso desde Mi bienestar en cualquier momento.",
};
const digest = createHash("sha256").update(JSON.stringify(notice)).digest("hex");
const civil = (value: Date) => value.toISOString().slice(0, 10);
const grantInput = z.object({ coachId: z.string().min(1).max(128), noticeVersion: z.literal(notice.version), accepted: z.literal(true) }).strict();
const queryInput = z.object({
  beforeStart: z.iso.date().refine(day => day >= "0001-01-01").optional(),
  beforeProgram: z.string().min(1).max(128).optional(),
}).strict().refine(query => !!query.beforeStart === !!query.beforeProgram);
const contextLimit = 12;

const evidence = consentEvidence(false);
const sharingProfile = {
  id: true, coachId: true, birthDate: true,
  coach: { select: { id: true, fullName: true, role: true, active: true } },
  sleepSharing: { select: { coachId: true, birthDate: true, noticeVersion: true, noticeDigest: true, revokedAt: true } },
  user: { select: { consents: { where: {
    textVersion: evidence.textVersion, textDigest: evidence.textDigest,
    acceptanceMode: evidence.acceptanceMode, guardianName: null,
  }, select: { id: true }, take: 1 } } },
} satisfies Prisma.AthleteSelect;
type SharingProfile = Prisma.AthleteGetPayload<{ select: typeof sharingProfile }>;

function blocked(profile: SharingProfile) {
  if (!registrationNotice(config.isProd).available || (config.isProd && notice.status !== "approved")) {
    return "La autorización específica para compartir sueño está pendiente de aprobación institucional.";
  }
  if (!profile.birthDate || isMinorOn(profile.birthDate) || !profile.user.consents.length) {
    return "La autorización está disponible solo para adultos con evidencia de consentimiento. El procedimiento para menores está pendiente.";
  }
  if (!profile.coach?.active || profile.coach.role !== "COACH") return "Necesitas un entrenador activo asignado.";
  return null;
}

function isShared(profile: SharingProfile) {
  const grant = profile.sleepSharing;
  return Boolean(grant && !blocked(profile) && !grant.revokedAt && grant.coachId === profile.coachId &&
    grant.noticeVersion === notice.version && grant.noticeDigest === digest &&
    civil(grant.birthDate) === civil(profile.birthDate!));
}

const missing = (res: Response) => res.status(404).json({ error: "Deportista no encontrado." });
const changed = (res: Response) => res.status(409).json({ error: "La autorización o la asignación cambió. Actualiza la información." });
const denied = (res: Response) => res.status(403).json({ error: "Las horas de sueño no están disponibles para esta consulta." });

ownSleep.get("/sharing", async (req, res) => {
  const athlete = await prisma.athlete.findUnique({ where: { userId: req.user!.sub }, select: sharingProfile });
  if (!athlete) return missing(res);
  res.json({
    noticeVersion: notice.version, text: notice.text, status: notice.status, active: isShared(athlete),
    coach: athlete.coach ? { id: athlete.coach.id, name: athlete.coach.fullName } : null,
    disabledReason: blocked(athlete), canRevoke: Boolean(athlete.sleepSharing && !athlete.sleepSharing.revokedAt),
  });
});

ownSleep.put("/sharing", async (req, res) => {
  const parsed = grantInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Confirma la autorización y su destinatario." });
  try {
    const outcome = await prisma.$transaction(async tx => {
      const athlete = await tx.athlete.findUnique({ where: { userId: req.user!.sub }, select: sharingProfile });
      if (!athlete) return "MISSING";
      if (blocked(athlete)) return "DENIED";
      if (athlete.coachId !== parsed.data.coachId) return "CHANGED";
      if (!isShared(athlete)) {
        const values = {
          coachId: parsed.data.coachId, birthDate: athlete.birthDate!, noticeVersion: notice.version, noticeDigest: digest,
        };
        await tx.sleepSharing.upsert({
          where: { athleteId: athlete.id }, create: { athleteId: athlete.id, ...values },
          update: { ...values, grantedAt: new Date(), revokedAt: null },
        });
      }
      return "OK";
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (outcome === "MISSING") return missing(res);
    if (outcome === "DENIED") return denied(res);
    if (outcome === "CHANGED") return changed(res);
    res.sendStatus(204);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) return changed(res);
    throw error;
  }
});

ownSleep.delete("/sharing", async (req, res) => {
  await prisma.sleepSharing.updateMany({
    where: { athlete: { userId: req.user!.sub }, revokedAt: null }, data: { revokedAt: new Date() },
  });
  res.sendStatus(204);
});

type Reading = { programId: string; name: string; startedOn: Date; day: Date; week: number; sleepTenths: number };
type SleepPoint = { day: string; week: number; hours: number };
type Period = { programId: string; name: string; startedOn: string; points: SleepPoint[] };

async function readings(tx: Prisma.TransactionClient, athleteId: string, query: z.infer<typeof queryInput>) {
  const cursor = query.beforeStart && query.beforeProgram
    ? Prisma.sql`AND (e."startedOn", e."programId") < (${new Date(query.beforeStart)}::date, ${query.beforeProgram})`
    : Prisma.empty;
  const rows = await tx.$queryRaw<Reading[]>`
    WITH measured AS (
      SELECT e."programId", e."startedOn", e.day, e.week, r."sleepTenths"
      FROM "WellbeingEntry" e
      JOIN "WellbeingRevision" r ON r."entryId" = e.id AND r.version = e.version
      WHERE e."athleteId" = ${athleteId} AND r."sleepTenths" IS NOT NULL ${cursor}
    ), periods AS (
      SELECT DISTINCT "startedOn", "programId" FROM measured
      ORDER BY "startedOn" DESC, "programId" DESC LIMIT ${contextLimit + 1}
    )
    SELECT m.*, p.name FROM measured m
    JOIN periods USING ("startedOn", "programId")
    JOIN "Program" p ON p.id = m."programId"
    ORDER BY m."startedOn" DESC, m."programId" DESC, m.day ASC
  `;
  const periods = new Map<string, Period>();
  for (const row of rows) {
    const startedOn = civil(row.startedOn);
    const key = JSON.stringify([startedOn, row.programId]);
    let period = periods.get(key);
    if (!period) {
      period = { startedOn, programId: row.programId, name: row.name, points: [] };
      periods.set(key, period);
    }
    period.points.push({ day: civil(row.day), week: row.week, hours: row.sleepTenths / 10 });
  }
  const page = [...periods.values()].slice(0, contextLimit);
  const last = page.at(-1);
  return {
    periods: page,
    next: last && periods.size > contextLimit ? { beforeStart: last.startedOn, beforeProgram: last.programId } : null,
  };
}

async function series(req: Request, res: Response, team: boolean) {
  const query = queryInput.safeParse(req.query);
  if (!query.success) return res.status(400).json({ error: "El periodo solicitado no es válido." });

  const { sub, role } = req.user!;
  const result = await prisma.$transaction(async tx => {
    if (team && role === "COACH") {
      const athlete = await tx.athlete.findFirst({
        where: { id: req.params.id, coachId: sub }, select: sharingProfile,
      });
      if (!athlete) return "MISSING";
      if (!isShared(athlete)) return "DENIED";
      return readings(tx, athlete.id, query.data);
    }
    const athlete = await tx.athlete.findFirst({
      where: team ? { id: req.params.id, ...documentedWellbeingScope(sub) } : { userId: sub }, select: { id: true },
    });
    if (!athlete) return team ? "DENIED" : "MISSING";
    return readings(tx, athlete.id, query.data);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  if (result === "MISSING") return missing(res);
  if (result === "DENIED") return denied(res);
  res.json(result);
}

ownSleep.get("/", (req, res) => series(req, res, false));
teamSleep.get("/", (req, res) => series(req, res, true));
