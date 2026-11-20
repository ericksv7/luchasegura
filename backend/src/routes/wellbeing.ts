import { createHash } from "node:crypto";
import { FatiguePerception, Prisma, RecoveryPerception, RestPerception } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { documentedWellbeingScope } from "../services/wellbeing-access";
import { calendarDay, loadProgramIdentity } from "../services/program";

export const ownWellbeing = Router();
export const teamWellbeing = Router({ mergeParams: true });

const dayMs = 86_400_000;
const civil = (date: Date) => date.toISOString().slice(0, 10);
const date = z.iso.date().refine(value => value >= "0001-01-01");
const revisionFields = {
  operationId: z.uuid(),
  sleepHours: z.number().min(0).max(24).multipleOf(0.1).nullable().default(null),
  rest: z.enum(RestPerception).nullable().default(null),
  fatigue: z.enum(FatiguePerception).nullable().default(null),
  recovery: z.enum(RecoveryPerception).nullable().default(null),
  notes: z.string().trim().max(500).nullable().default(null),
};
const newEntry = z.object({
  ...revisionFields, day: date,
  intervention: z.object({ programId: z.string().min(1).max(128), startedOn: date }).strict(),
}).strict();
const editEntry = z.object({
  ...revisionFields, expectedVersion: z.number().int().min(1).max(2_147_483_646),
}).strict();
const pageQuery = z.object({ cursor: z.uuid().optional() }).strict();
const revisionQuery = z.object({ before: z.coerce.number().int().positive().max(2_147_483_647).optional() }).strict();
const pageSize = 14;

const publicFields = {
  recordedAt: true, version: true, sleepTenths: true, rest: true, fatigue: true, recovery: true,
} satisfies Prisma.WellbeingRevisionSelect;
const ownerFields = { ...publicFields, notes: true } satisfies Prisma.WellbeingRevisionSelect;
const entryFields = {
  id: true, day: true, startedOn: true, week: true, version: true, createdAt: true, updatedAt: true,
  program: { select: { id: true, name: true } },
} satisfies Prisma.WellbeingEntrySelect;

function presentRevision<T extends { sleepTenths: number | null }>({ sleepTenths, ...revision }: T) {
  return { ...revision, sleepHours: sleepTenths === null ? null : sleepTenths / 10 };
}

function presentEntry<T extends Prisma.WellbeingEntryGetPayload<{ select: typeof entryFields }> & {
  revisions: { sleepTenths: number | null }[];
}>({ day, startedOn, revisions, ...entry }: T) {
  return { ...entry, day: civil(day), startedOn: civil(startedOn), current: presentRevision(revisions[0]) };
}

async function activeIntervention(athlete: { programStartedAt: Date | null },
  client: Pick<Prisma.TransactionClient, "program"> = prisma) {
  if (!athlete.programStartedAt) return null;
  const program = await loadProgramIdentity(client);
  if (!program || program.weeks < 1) return null;
  return {
    programId: program.id,
    startedOn: civil(athlete.programStartedAt),
    endsOn: civil(new Date(athlete.programStartedAt.getTime() + (program.weeks * 7 - 1) * dayMs)),
  };
}

async function profile(userId: string) {
  return prisma.athlete.findUnique({ where: { userId }, select: { id: true, programStartedAt: true } });
}

const notFound = (res: Response) => res.status(404).json({ error: "Registro no encontrado." });
const invalid = (res: Response) => res.status(400).json({
  error: "Revisa la fecha, las horas de sueño y las respuestas. Registra al menos una medición.",
});

async function list(req: Request, res: Response, athleteId: string, owner: boolean) {
  const query = pageQuery.safeParse(req.query);
  if (!query.success) { invalid(res); return null; }
  const cursor = query.data.cursor ? await prisma.wellbeingEntry.findFirst({
    where: { id: query.data.cursor, athleteId }, select: { day: true, id: true },
  }) : null;
  if (query.data.cursor && !cursor) { notFound(res); return null; }
  const entries = await prisma.wellbeingEntry.findMany({
    where: { athleteId, ...(cursor ? { OR: [{ day: { lt: cursor.day } }, { day: cursor.day, id: { lt: cursor.id } }] } : {}) },
    select: {
      ...entryFields, revisions: { select: owner ? ownerFields : publicFields, orderBy: { version: "desc" }, take: 1 },
    },
    orderBy: [{ day: "desc" }, { id: "desc" }], take: pageSize + 1,
  });
  const page = entries.slice(0, pageSize);
  return { entries: page.map(entry => presentEntry(entry)), nextCursor: entries.length > pageSize ? page.at(-1)!.id : null };
}

ownWellbeing.get("/", async (req, res) => {
  const athlete = await profile(req.user!.sub);
  if (!athlete) return notFound(res);
  const page = await list(req, res, athlete.id, true);
  if (page) res.json({ ...page, intervention: await activeIntervention(athlete), today: calendarDay(new Date()) });
});

ownWellbeing.get("/:id", async (req, res) => {
  const entry = await prisma.wellbeingEntry.findFirst({
    where: { id: req.params.id, athlete: { userId: req.user!.sub } },
    select: { ...entryFields, revisions: { select: ownerFields, orderBy: { version: "desc" }, take: 1 } },
  });
  if (!entry) return notFound(res);
  res.json(presentEntry(entry));
});

ownWellbeing.get("/:id/revisions", async (req, res) => {
  const query = revisionQuery.safeParse(req.query);
  if (!query.success) return invalid(res);
  const entry = await prisma.wellbeingEntry.findFirst({
    where: { id: req.params.id, athlete: { userId: req.user!.sub } },
    select: { revisions: {
      where: { version: { lt: query.data.before } }, select: ownerFields,
      orderBy: { version: "desc" }, take: pageSize + 1,
    } },
  });
  if (!entry) return notFound(res);
  const items = entry.revisions.slice(0, pageSize);
  res.json({ revisions: items.map(presentRevision), nextBefore: entry.revisions.length > pageSize ? items.at(-1)!.version : null });
});

async function save(req: Request, res: Response, updating: boolean) {
  const parsed = (updating ? editEntry : newEntry).safeParse(req.body);
  if (!parsed.success) return invalid(res);
  const input = parsed.data;
  if ([input.sleepHours, input.rest, input.fatigue, input.recovery].every(value => value === null)) return invalid(res);
  const athlete = await profile(req.user!.sub);
  if (!athlete) return notFound(res);
  const id = updating ? req.params.id : input.operationId;
  const fingerprint = createHash("sha256").update(JSON.stringify({ athleteId: athlete.id, id, input })).digest("hex");
  const stale = () => res.status(409).json({
    code: "STALE", error: "El registro cambió. Consulta la versión vigente antes de volver a guardar.",
  });
  const replay = async () => {
    const previous = await prisma.wellbeingRevision.findFirst({
      where: { operationId: input.operationId, entry: { athleteId: athlete.id } },
      select: { version: true, fingerprint: true },
    });
    if (!previous) return false;
    if (previous.fingerprint === fingerprint) res.json({ id, version: previous.version });
    else stale();
    return true;
  };
  if (await replay()) return;
  const fields = {
    operationId: input.operationId, fingerprint,
    sleepTenths: input.sleepHours === null ? null : Math.round(input.sleepHours * 10),
    rest: input.rest, fatigue: input.fatigue, recovery: input.recovery, notes: input.notes || null,
  };
  try {
    const outcome = await prisma.$transaction(async tx => {
      if ("expectedVersion" in input) {
        const scoped = { id, athleteId: athlete.id };
        const updated = await tx.wellbeingEntry.updateMany({
          where: { ...scoped, version: input.expectedVersion }, data: { version: { increment: 1 } },
        });
        if (!updated.count) return await tx.wellbeingEntry.count({ where: scoped }) ? "STALE" : "MISSING";
        const version = input.expectedVersion + 1;
        await tx.wellbeingRevision.create({ data: { ...fields, entryId: id, version } });
        return version;
      }

      const currentAthlete = await tx.athlete.findUnique({ where: { id: athlete.id }, select: { programStartedAt: true } });
      if (!currentAthlete) return "MISSING";
      const context = await activeIntervention(currentAthlete, tx);
      if (!context || context.programId !== input.intervention.programId || context.startedOn !== input.intervention.startedOn) {
        return "CONTEXT";
      }
      if (input.day > calendarDay(new Date()) || input.day < context.startedOn || input.day > context.endsOn) return "DATE";
      const startedOn = new Date(context.startedOn);
      const day = new Date(input.day);
      await tx.wellbeingEntry.create({ data: {
        id, athleteId: athlete.id, programId: context.programId, startedOn, day,
        week: Math.floor((day.getTime() - startedOn.getTime()) / (7 * dayMs)) + 1,
        revisions: { create: { ...fields, version: 1 } },
      } });
      return 1;
    });
    if (outcome === "MISSING") return notFound(res);
    if (outcome === "DATE") return res.status(400).json({ error: "Elige una fecha de la intervención que no sea futura en Bogotá." });
    if (outcome === "CONTEXT") return res.status(409).json({
      code: "CONTEXT", error: "La intervención cambió. Actualiza el periodo disponible antes de registrar.",
    });
    if (outcome === "STALE") {
      if (await replay()) return;
      return stale();
    }
    res.status(updating ? 200 : 201).json({ id, version: outcome });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2003", "P2034"].includes(error.code)) {
      if (await replay()) return;
      if ("day" in input) {
        const existing = await prisma.wellbeingEntry.findUnique({
          where: { athleteId_programId_day: { athleteId: athlete.id, programId: input.intervention.programId, day: new Date(input.day) } },
          select: { id: true },
        });
        if (existing) return res.status(409).json({
          code: "EXISTS", id: existing.id, error: "Ya hay un registro para esa fecha. Puedes consultar la versión guardada.",
        });
      }
      return stale();
    }
    throw error;
  }
}

ownWellbeing.post("/", (req, res) => save(req, res, false));
ownWellbeing.patch("/:id", (req, res) => save(req, res, true));

teamWellbeing.get("/", async (req: Request, res) => {
  const authorId = req.user!.sub;
  // La ficha general no implica una relación asistencial documentada.
  const athlete = await prisma.athlete.findFirst({
    where: { id: req.params.id, ...documentedWellbeingScope(authorId) },
    select: { id: true },
  });
  if (!athlete) return res.status(403).json({ error: "La consulta requiere una atención de fisioterapia documentada para este deportista." });
  const page = await list(req, res, athlete.id, false);
  if (page) res.json(page);
});
