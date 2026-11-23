import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { calendarDay } from "../services/program";
import { documentedWellbeingScope } from "../services/wellbeing-access";

const optionalText = (max: number) => z.string().trim().min(1).max(max).nullable();
const day = z.iso.date().refine(value => value >= "0001-01-01" && value <= calendarDay(new Date()));
const period = z.iso.date().refine(value => value >= "0001-01-01" && value <= calendarDay(new Date()));
const detailsSchema = z.strictObject({
  zone: z.enum(["Cuello", "Hombro", "Codo", "Muñeca o mano", "Zona dorsal", "Zona lumbar", "Cadera", "Rodilla", "Tobillo o pie", "Otra"]).nullable(),
  side: z.enum(["LEFT", "RIGHT", "BILATERAL", "NOT_APPLICABLE"]).nullable(),
  eventOn: day.nullable(),
  approximateSince: period.nullable(),
  approximateUntil: period.nullable(),
  recurrent: z.boolean().nullable(),
  context: z.enum(["TRAINING", "COMPETITION", "OTHER"]).nullable(),
  activity: optionalText(120),
  mechanism: optionalText(250),
  consequence: optionalText(500),
  daysAbsent: z.number().int().min(0).max(3650).nullable(),
  classification: optionalText(120),
  source: z.enum(["ATHLETE", "PROFESSIONAL", "DOCUMENT"]).nullable(),
  treatment: optionalText(500),
  prevention: optionalText(500),
  caseStatus: z.enum(["OPEN", "FOLLOW_UP", "RESOLVED"]).nullable(),
  reason: optionalText(500),
}).refine(value => (!value.eventOn || (!value.approximateSince && !value.approximateUntil))
  && (!value.approximateSince || !value.approximateUntil || value.approximateSince <= value.approximateUntil)
  && (!value.classification || value.source === "PROFESSIONAL" || value.source === "DOCUMENT"));

const write = z.strictObject({
  operationId: z.uuid(),
  expectedVersion: z.number().int().min(0).max(2147483646),
  details: detailsSchema,
}).refine(input => input.expectedVersion === 0 || input.details.reason !== null);
const revisionFields = { version: true, authorName: true, recordedAt: true, details: true } satisfies Prisma.InjuryCharacterizationSelect;

export const injuryCharacterizations = Router({ mergeParams: true });

injuryCharacterizations.get("/", async (req, res) => {
  const athleteId = req.params.id;
  const injury = await prisma.injury.findFirst({
    where: { id: req.params.injuryId, athleteId, athlete: documentedWellbeingScope(req.user!.sub) },
    select: { characterizations: { orderBy: { version: "desc" }, select: revisionFields } },
  });
  if (!injury) return res.status(404).json({ error: "Registro fuera del alcance de atención documentada" });
  res.json(injury.characterizations);
});

injuryCharacterizations.put("/", async (req, res) => {
  const parsed = write.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Revisa las fechas, la fuente de la clasificación y el motivo de corrección." });
  const { operationId, expectedVersion, details } = parsed.data;
  const { id: athleteId, injuryId } = req.params;
  const authorId = req.user!.sub;
  const fingerprint = createHash("sha256").update(JSON.stringify({ athleteId, injuryId, authorId, expectedVersion, details })).digest("hex");

  const save = () => prisma.$transaction(async tx => {
    const author = await tx.user.findFirst({ where: { id: authorId, active: true, role: "PHYSIO", mustChangePassword: false }, select: { fullName: true } });
    const injury = await tx.injury.findFirst({
      where: { id: injuryId, athleteId, athlete: documentedWellbeingScope(authorId) },
      select: { characterizations: { orderBy: { version: "desc" }, take: 1, select: { version: true } } },
    });
    if (!author || !injury) return null;
    const previous = await tx.injuryCharacterization.findUnique({ where: { operationId }, select: { fingerprint: true, version: true } });
    if (previous) return previous.fingerprint === fingerprint ? previous.version : false;
    if ((injury.characterizations[0]?.version ?? 0) !== expectedVersion) return false;
    const { version } = await tx.injuryCharacterization.create({ data: {
      operationId, injuryId, authorId, authorName: author.fullName, version: expectedVersion + 1, details, fingerprint,
    } });
    return version;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const version = await save();
      if (version === null) return res.status(404).json({ error: "Registro fuera del alcance de atención documentada" });
      if (version === false) break;
      return res.json({ version });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !["P2002", "P2003", "P2034"].includes(error.code)) throw error;
    }
  }
  return res.status(409).json({ error: "El registro cambió. Recarga la caracterización antes de reintentar." });
});
