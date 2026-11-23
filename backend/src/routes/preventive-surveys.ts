import { createHash, randomUUID } from "node:crypto";
import { PreventiveSurveyKind, Prisma } from "@prisma/client";
import { Router, type Request } from "express";
import { z } from "zod";
import { config } from "../config";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { isMinorOn } from "../services/consent";
import { calendarDay, loadProgramIdentity } from "../services/program";
import { catalogueFor, shiftDay, surveyNotice, validateAnswers, windowFor } from "../services/preventive-survey";
import { documentedWellbeingScope } from "../services/wellbeing-access";

export const preventiveSurveys = Router();
preventiveSurveys.use(requireAuth, requireRole("ATHLETE", "PHYSIO", "COACH"), (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const enabled = !config.isProd && process.env.PREVENTIVE_SURVEYS_DEMO === "1";
const scope = (req: Request): Prisma.AthleteWhereInput => {
  const actor = req.user!;
  if (actor.role === "ATHLETE") return { userId: actor.sub };
  const id = req.params.athleteId;
  if (!id) return { id: { in: [] } };
  return actor.role === "COACH" ? { id, coachId: actor.sub } : { id, ...documentedWellbeingScope(actor.sub) };
};
const athleteScope = (db: Prisma.TransactionClient, req: Request) => db.athlete.findFirst({
  where: { ...scope(req), user: { active: true, role: "ATHLETE" } },
  select: {
    id: true, userId: true, birthDate: true, programStartedAt: true, category: true, style: true,
    yearsExperience: true, surveyConsent: true,
  },
});
type Athlete = NonNullable<Awaited<ReturnType<typeof athleteScope>>>;
const eligible = (athlete: Athlete, now: Date) => !!athlete.birthDate && !isMinorOn(athlete.birthDate, now);
const accepted = (athlete: Athlete, now: Date) => enabled && eligible(athlete, now) &&
  athlete.surveyConsent?.version === surveyNotice.version && athlete.surveyConsent.text === surveyNotice.text && !athlete.surveyConsent.revokedAt;
const civil = (d: Date) => d.toISOString().slice(0, 10);
const openedKinds = (req: Request): PreventiveSurveyKind[] =>
  req.user!.role === "COACH" ? ["COACH"] : ["INITIAL", "FINAL"];

async function contextFor(db: Prisma.TransactionClient, athlete: Athlete) {
  if (!athlete.programStartedAt) return null;
  const program = await loadProgramIdentity(db);
  if (program?.weeks !== 8) return null;
  return { programId: program.id, startedOn: civil(athlete.programStartedAt) };
}

function questionnaire(kind: PreventiveSurveyKind, start: string, today: string) {
  const reference = kind === "INITIAL" ? { from: shiftDay(start, -63), to: shiftDay(start, -8) }
    : kind === "FINAL" ? { from: start, to: shiftDay(start, 55) }
    : { from: shiftDay(today, -7), to: shiftDay(today, -1) };
  return { ...catalogueFor(kind), reference };
}

const current = { orderBy: { version: "desc" }, take: 1 } as const;
const recordInclude = { revisions: current, program: { select: { name: true } } } satisfies Prisma.PreventiveSurveyInclude;
type Survey = Prisma.PreventiveSurveyGetPayload<{ include: typeof recordInclude }>;

function present(survey: Survey, professional: boolean) {
  const canRead = !professional || !!survey.submittedAt;
  return {
    id: survey.id, kind: survey.kind, programId: survey.programId, programName: survey.program.name,
    startedOn: civil(survey.startedOn), submittedAt: survey.submittedAt, catalogueVersion: survey.catalogueVersion,
    version: survey.version, catalogue: canRead ? survey.catalogue : null,
    sportContext: canRead ? survey.sportContext : null,
    answers: canRead ? survey.revisions[0]?.answers ?? {} : null,
    updatedAt: survey.revisions[0]?.recordedAt,
  };
}

preventiveSurveys.get(["/me", "/team/:athleteId"], async (req, res) => {
  if ((req.path === "/me") !== (req.user!.role === "ATHLETE")) return res.sendStatus(403);
  const query = z.object({ cursor: z.uuid().optional() }).strict().safeParse(req.query);
  if (!query.success) return res.sendStatus(400);
  const now = new Date();
  const today = calendarDay(now);
  const data = await prisma.$transaction(async tx => {
    const athlete = await athleteScope(tx, req);
    if (!athlete) return null;
    const consent = accepted(athlete, now);
    const own = req.user!.role === "ATHLETE";
    const professional = req.user!.role === "PHYSIO";
    const context = consent ? await contextFor(tx, athlete) : null;
    const kinds = openedKinds(req);
    const where = { athleteId: athlete.id, kind: { in: kinds }, respondentId: professional ? athlete.userId : req.user!.sub };
    if (consent && query.data.cursor && !await tx.preventiveSurvey.findFirst({ where: { ...where, id: query.data.cursor }, select: { id: true } })) return null;
    const rows = consent ? await tx.preventiveSurvey.findMany({
      where, include: recordInclude, take: 21,
      ...(query.data.cursor ? { cursor: { id: query.data.cursor }, skip: 1 } : {}),
      orderBy: [{ startedOn: "desc" }, { id: "desc" }],
    }) : [];
    const slots = context ? await Promise.all(kinds.map(async kind => {
      const record = await tx.preventiveSurvey.findFirst({
        where: { ...where, ...context, startedOn: new Date(context.startedOn), kind }, include: recordInclude,
      });
      return {
        kind, ...context, opensOn: kind === "INITIAL" ? shiftDay(context.startedOn, -7) : kind === "FINAL" ? shiftDay(context.startedOn, 56) : null,
        writable: !professional && !record?.submittedAt && windowFor(kind, context.startedOn, today),
        catalogue: record?.catalogue ?? questionnaire(kind, context.startedOn, today),
        sportContext: own ? record?.sportContext ?? { experience: athlete.yearsExperience, category: athlete.category, style: athlete.style } : null,
        record: record ? present(record, professional) : null,
      };
    })) : [];
    return {
      enabled, eligible: own && eligible(athlete, now), consent, revoked: own && !!athlete.surveyConsent?.revokedAt,
      notice: own ? surveyNotice : null, today, context, slots,
      records: rows.slice(0, 20).map(row => present(row, professional)),
      next: rows.length > 20 ? rows[19].id : null,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  if (!data) return res.sendStatus(404);
  res.json(data);
});

preventiveSurveys.put("/me/consent", requireRole("ATHLETE"), async (req, res) => {
  if (!enabled) return res.sendStatus(403);
  if (!z.object({ accepted: z.literal(true), version: z.literal(surveyNotice.version) }).strict().safeParse(req.body).success) return res.sendStatus(400);
  const athlete = await athleteScope(prisma, req);
  if (!athlete || !eligible(athlete, new Date())) return res.sendStatus(403);
  const evidence = await prisma.preventiveSurveyConsent.upsert({
    where: { athleteId: athlete.id }, update: {},
    create: { athleteId: athlete.id, ...surveyNotice },
  });
  res.sendStatus(evidence.revokedAt ? 409 : 204);
});

preventiveSurveys.delete("/me/consent", requireRole("ATHLETE"), async (req, res) => {
  await prisma.preventiveSurveyConsent.updateMany({
    where: { athlete: { userId: req.user!.sub }, revokedAt: null }, data: { revokedAt: new Date() },
  });
  res.sendStatus(204);
});

const mutation = z.object({
  kind: z.enum(PreventiveSurveyKind),
  programId: z.string().min(1).max(128), startedOn: z.iso.date().refine(day => day >= "1900-01-01" && day <= "9998-12-31"),
  referenceFrom: z.iso.date(), operationId: z.uuid(), expectedVersion: z.number().int().min(0).max(2_147_483_646),
  catalogueVersion: z.string().min(1).max(100), submit: z.boolean(), answers: z.record(z.string().max(80), z.unknown()),
}).strict();

preventiveSurveys.put(["/me", "/team/:athleteId"], requireRole("ATHLETE", "COACH"), async (req, res) => {
  if ((req.path === "/me") !== (req.user!.role === "ATHLETE") || !enabled) return res.sendStatus(403);
  const parsed = mutation.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Solicitud de encuesta inválida." });
  const { kind, programId, startedOn, operationId, expectedVersion, catalogueVersion, referenceFrom, submit, answers } = parsed.data;
  if (!openedKinds(req).includes(kind)) return res.sendStatus(403);
  const now = new Date();
  const today = calendarDay(now);
  const actorId = req.user!.sub;
  const fingerprint = createHash("sha256").update(JSON.stringify([
    kind, programId, startedOn, expectedVersion, catalogueVersion, referenceFrom, submit, Object.entries(answers).sort(([a], [b]) => a.localeCompare(b)),
  ])).digest("hex");
  try {
    const result = await prisma.$transaction(async tx => {
      const athlete = await athleteScope(tx, req);
      if (!athlete || !accepted(athlete, now)) return { status: 403 };
      const key = { athleteId: athlete.id, programId, startedOn: new Date(startedOn), kind, respondentId: actorId };
      const record = await tx.preventiveSurvey.findUnique({ where: { athleteId_programId_startedOn_kind_respondentId: key }, include: recordInclude });
      const previous = await tx.preventiveSurveyRevision.findUnique({ where: { operationId } });
      if (previous) {
        return previous.surveyId === record?.id && previous.version === record.version && previous.fingerprint === fingerprint
          ? { status: 200, record: present(record, false) } : { status: 409 };
      }
      const context = await contextFor(tx, athlete);
      if (context?.programId !== programId || context.startedOn !== startedOn || !windowFor(kind, startedOn, today)) return { status: 409 };
      if (record?.submittedAt || (record?.version ?? 0) !== expectedVersion) return { status: 409 };
      const catalogue = (record?.catalogue ?? questionnaire(kind, startedOn, today)) as ReturnType<typeof questionnaire>;
      if (catalogue.version !== catalogueVersion || catalogue.reference.from !== referenceFrom) return { status: 409 };
      const checked = validateAnswers(catalogue, answers, submit);
      if (checked.invalid.length) return { status: 422, invalid: checked.invalid };
      const id = record?.id ?? randomUUID();
      const version = expectedVersion + 1;
      const revision = { actorId, operationId, fingerprint, answers: checked.answers, version };
      const submittedAt = submit ? now : null;
      const updated = record ? await tx.preventiveSurvey.update({
        where: { id, version: expectedVersion, submittedAt: null },
        data: { version, submittedAt, revisions: { create: revision } }, include: recordInclude,
      }) : await tx.preventiveSurvey.create({
        data: {
          ...key, id, version, submittedAt, catalogue, catalogueVersion,
          sportContext: kind === "COACH" ? {} : { experience: athlete.yearsExperience, category: athlete.category, style: athlete.style },
          revisions: { create: revision },
        }, include: recordInclude,
      });
      return { status: 200, record: present(updated, false) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.status === 200) return res.json(result.record);
    if (result.status === 422) return res.status(422).json({ error: "Revisa las respuestas señaladas.", invalid: result.invalid });
    if (result.status === 403) return res.sendStatus(403);
    return res.status(409).json({ error: "La encuesta, el periodo o su versión cambió. Consulta el estado vigente." });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2025", "P2034"].includes(error.code)) {
      return res.status(409).json({ error: "Otra operación cambió la encuesta. Puedes reintentar o consultar la versión vigente." });
    }
    throw error;
  }
});

preventiveSurveys.get(["/me/:id/history", "/team/:athleteId/:id/history"], requireRole("ATHLETE", "COACH"), async (req, res) => {
  if ((req.path.startsWith("/me/")) !== (req.user!.role === "ATHLETE")) return res.sendStatus(403);
  const query = z.object({ before: z.coerce.number().int().positive().max(2_147_483_647).optional() }).strict().safeParse(req.query);
  if (!z.uuid().safeParse(req.params.id).success || !query.success) return res.sendStatus(400);
  const athlete = await athleteScope(prisma, req);
  if (!athlete || !accepted(athlete, new Date())) return res.sendStatus(403);
  const record = await prisma.preventiveSurvey.findFirst({
    where: { id: req.params.id, athleteId: athlete.id, respondentId: req.user!.sub, kind: { in: openedKinds(req) } },
    select: { revisions: {
      select: { version: true, answers: true, recordedAt: true }, orderBy: { version: "desc" }, take: 21,
      where: query.data.before ? { version: { lt: query.data.before } } : {},
    } },
  });
  if (!record) return res.sendStatus(404);
  res.json({ revisions: record.revisions.slice(0, 20), next: record.revisions.length > 20 ? record.revisions[19].version : null });
});
