import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { calendarDay, loadProgramIdentity } from "../services/program";

import { protocolCode } from "../services/program-report-metrics";

const instruments = z.enum(["SEBT", "YBT", "T_TEST"]);
const measurements = z.array(z.object({
  value: z.number().finite().nonnegative(),
  side: z.enum(["LEFT", "RIGHT"]).optional(),
  direction: z.string().trim().min(1).max(40).optional(),
}).strict()).min(1).max(24);
const revision = z.object({
  operationId: z.uuid(),
  measuredOn: z.iso.date().refine(day => day >= "0001-01-01" && day <= calendarDay(new Date())),
  measurements,
  protocol: protocolCode.nullable().optional(),
  observations: z.string().trim().max(1000).nullable(),
}).strict();
const create = revision.extend({
  instrument: instruments, phase: z.enum(["INITIAL", "FINAL"]),
  intervention: z.object({ programId: z.string().min(1), startedAt: z.iso.date() }).strict(),
});
const edit = revision.extend({ expectedVersion: z.number().int().min(1).max(2147483646) });
type RevisionInput = z.infer<typeof revision>;

function validMeasurements(instrument: string, values: RevisionInput["measurements"]) {
  return values.every(row => instrument === "T_TEST"
    ? row.value > 0 && row.side === undefined && row.direction === undefined
    : row.side !== undefined && row.direction !== undefined);
}

const civil = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;

const publicRevision = { measuredOn: true, result: true } satisfies Prisma.FunctionalTestRevisionSelect;
const teamRevision = {
  ...publicRevision, version: true, recordedAt: true, observations: true,
  authorId: true, authorName: true,
} satisfies Prisma.FunctionalTestRevisionSelect;

const professional = (item: { authorId: string; authorName: string }) =>
  ({ id: item.authorId, fullName: item.authorName });

export async function listTeamEvaluations(req: Request, res: Response) {
  const athlete = await prisma.athlete.findUnique({
    where: { id: req.params.id }, select: { id: true, programStartedAt: true },
  });
  if (!athlete) return res.status(404).json({ error: "Deportista no encontrado" });
  const program = athlete.programStartedAt ? await loadProgramIdentity() : null;
  const tests = await prisma.functionalTest.findMany({
    where: { athleteId: athlete.id },
    orderBy: [{ measuredAt: "desc" }, { id: "asc" }],
    select: {
      id: true, testType: true, phase: true, result: true, measuredAt: true, version: true,
      interventionStartedAt: true, program: { select: { id: true, name: true } },
      revisions: { select: teamRevision, orderBy: { version: "desc" }, take: 1 },
    },
  });
  res.json({
    protocolStatus: "AWAITING_VALIDATION",
    dependency: "Quedan pendientes de aprobación los protocolos de aplicación, puntuación e interpretación.",
    intervention: program ? { programId: program.id, startedAt: civil(athlete.programStartedAt) } : null,
    tests: tests.map(({ revisions, interventionStartedAt, ...test }) => {
      const latest = revisions[0];
      return {
        ...test, interventionStartedAt: civil(interventionStartedAt),
        result: latest ? latest.result : test.result, measuredOn: civil(latest?.measuredOn ?? null),
        observations: latest?.observations ?? null, author: latest ? professional(latest) : null,
      };
    }),
  });
}

export async function listOwnEvaluations(req: Request, res: Response) {
  const tests = await prisma.functionalTest.findMany({
    where: { athlete: { userId: req.user!.sub }, version: { gt: 0 } },
    orderBy: [{ measuredAt: "desc" }, { id: "asc" }],
    select: {
      id: true, testType: true, phase: true, interventionStartedAt: true,
      program: { select: { id: true, name: true } },
      revisions: { select: publicRevision, orderBy: { version: "desc" }, take: 1 },
    },
  });
  res.json({ tests: tests.flatMap(({ revisions, interventionStartedAt, ...test }) => revisions.map(latest => ({
    ...test, interventionStartedAt: civil(interventionStartedAt),
    measuredOn: civil(latest.measuredOn), result: latest.result,
  }))) });
}

export async function listEvaluationRevisions(req: Request, res: Response) {
  const test = await prisma.functionalTest.findFirst({
    where: { id: req.params.testId, athleteId: req.params.id, version: { gt: 0 } },
    select: { revisions: { orderBy: { version: "desc" }, select: teamRevision } },
  });
  if (!test) return res.status(404).json({ error: "Evaluación no encontrada" });
  res.json(test.revisions.map(({ authorId, authorName, ...item }) => ({
    ...item, measuredOn: civil(item.measuredOn), author: professional({ authorId, authorName }),
  })));
}

const invalid = (res: Response) => res.status(400).json({
  error: "Revisa la fecha y las mediciones. Los alcances requieren lado y dirección. Los tiempos deben ser mayores que cero.",
});
const conflict = (res: Response) => res.status(409).json({
  error: "El registro cambió o la solicitud ya se usó con otros datos. Actualiza las evaluaciones antes de guardar.",
});

async function save(req: Request, res: Response, isEdit: boolean) {
  const parsed = isEdit ? edit.safeParse(req.body) : create.safeParse(req.body);
  if (!parsed.success) return invalid(res);
  const input = parsed.data;
  const authorId = req.user!.sub;
  const athleteId = req.params.id;
  const testId = isEdit ? req.params.testId : input.operationId;
  const fingerprint = createHash("sha256").update(JSON.stringify({ athleteId, testId, authorId, input })).digest("hex");
  const previousResponse = async () => {
    const prior = await prisma.functionalTestRevision.findUnique({
      where: { operationId: input.operationId }, select: { fingerprint: true, version: true },
    });
    if (!prior) return false;
    if (prior.fingerprint === fingerprint) res.json({ id: testId, version: prior.version });
    else conflict(res);
    return true;
  };

  if (await previousResponse()) return;
  const result = { measurements: input.measurements, ...(input.protocol ? { protocol: input.protocol } : {}) };
  const measuredOn = new Date(input.measuredOn);
  try {
    const outcome = await prisma.$transaction(async tx => {
      const author = await tx.user.findFirst({
        where: { id: authorId, role: "PHYSIO", active: true, mustChangePassword: false }, select: { fullName: true },
      });
      if (!author) return "FORBIDDEN";
      const snapshot = {
        operationId: input.operationId, authorId, authorName: author.fullName,
        measuredOn, result, observations: input.observations, fingerprint,
      };
      if ("expectedVersion" in input) {
        const test = await tx.functionalTest.findFirst({
          where: { id: testId, athleteId, version: { gt: 0 } }, select: { testType: true, revisions: { orderBy: { version: "desc" }, take: 1, select: { result: true } } },
        });
        if (!test) return "NOT_FOUND";
        if (!validMeasurements(test.testType, input.measurements)) return "INVALID";
        const updated = await tx.functionalTest.updateMany({
          where: { id: testId, athleteId, version: input.expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (!updated.count) return "CONFLICT";
        const version = input.expectedVersion + 1;
        const previous = z.object({ protocol: protocolCode.optional() }).safeParse(test.revisions[0]?.result);
        const retained = input.protocol === undefined && previous.success ? previous.data.protocol : undefined;
        await tx.functionalTestRevision.create({ data: {
          ...snapshot, testId, version, result: retained ? { ...result, protocol: retained } : result,
        } });
        return version;
      }

      if (!validMeasurements(input.instrument, input.measurements)) return "INVALID";
      const athlete = await tx.athlete.findUnique({ where: { id: athleteId }, select: { programStartedAt: true } });
      if (!athlete) return "NOT_FOUND";
      const program = await loadProgramIdentity(tx);
      if (!program || !athlete.programStartedAt ||
        program.id !== input.intervention.programId ||
        civil(athlete.programStartedAt) !== input.intervention.startedAt) return "NO_INTERVENTION";
      await tx.functionalTest.create({
        data: {
          id: testId, athleteId, programId: program.id, interventionStartedAt: athlete.programStartedAt,
          phase: input.phase, testType: input.instrument, result, measuredAt: measuredOn, version: 1,
          revisions: { create: { ...snapshot, version: 1 } },
        },
      });
      return 1;
    });
    if (outcome === "FORBIDDEN") return res.status(403).json({ error: "No tienes permiso para esta acción" });
    if (outcome === "INVALID") return invalid(res);
    if (outcome === "NOT_FOUND") return res.status(404).json({ error: "Deportista o evaluación no encontrado" });
    if (outcome === "NO_INTERVENTION") {
      return res.status(409).json({ error: "La intervención no coincide. Verifica su inicio y actualiza las evaluaciones." });
    }
    if (outcome === "CONFLICT") {
      if (await previousResponse()) return;
      return conflict(res);
    }
    res.status(isEdit ? 200 : 201).json({ id: testId, version: outcome });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2003", "P2034"].includes(error.code)) {
      if (await previousResponse()) return;
      return conflict(res);
    }
    throw error;
  }
}

export const createEvaluation = (req: Request, res: Response) => save(req, res, false);
export const editEvaluation = (req: Request, res: Response) => save(req, res, true);
