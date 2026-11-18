import { Request, Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

export const exercisesRouter = Router();
exercisesRouter.use(requireAuth);

const COMPONENTS = ["Movilidad", "Estabilidad", "Fuerza", "Técnica"] as const;

const IMG = /\.(jpe?g|png|gif|webp)$/i;
const HOSTS = new Set([
  "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be",
  "vimeo.com", "www.vimeo.com", "player.vimeo.com",
]);
function allowedMedia(raw: string) {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && (HOSTS.has(u.hostname) || IMG.test(u.pathname));
  } catch {
    return false;
  }
}

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optText = (max: number) => z.preprocess(blankToNull, z.string().trim().max(max).nullable().optional());
const mediaField = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .max(300)
    .refine(allowedMedia, "Usa un enlace https de YouTube, Vimeo o de una imagen (.jpg, .png, .gif, .webp)")
    .nullable()
    .optional()
);

const exerciseSchema = z.object({
  component: z.enum(COMPONENTS),
  name: z.string().trim().min(2, "Escribe el nombre del ejercicio").max(80),
  description: optText(600),
  dosage: optText(80),
  zone: optText(60),
  mediaUrl: mediaField,
});

const assignSchema = z.object({
  athleteId: z.string().min(1),
  exerciseId: z.string().min(1),
  dosage: optText(80),
  note: optText(300),
});

type Plain = {
  id: string; component: string; name: string; description: string | null;
  dosage: string | null; zone: string | null; mediaUrl: string | null;
};
const toExercise = (e: Plain) => ({
  id: e.id, component: e.component, name: e.name, description: e.description,
  dosage: e.dosage, zone: e.zone, mediaUrl: e.mediaUrl,
});

const assignmentInclude = {
  exercise: true,
  assignedBy: { select: { fullName: true } },
} satisfies Prisma.ExerciseAssignmentInclude;
type AssignmentRow = Prisma.ExerciseAssignmentGetPayload<{ include: typeof assignmentInclude }>;
const toAssignment = (a: AssignmentRow) => ({
  id: a.id,
  dosage: a.dosage,
  note: a.note,
  createdAt: a.createdAt,
  assignedBy: a.assignedBy?.fullName ?? null,
  exercise: toExercise(a.exercise),
});

// El entrenador solo ve a sus deportistas; el fisioterapeuta ve a todos
function inScope(req: Request, athleteId: string) {
  return prisma.athlete.findFirst({
    where: { id: athleteId, ...(req.user!.role === "COACH" ? { coachId: req.user!.sub } : {}) },
    select: { id: true },
  });
}

// ===== Asignaciones (van antes que las rutas con :id) =====

exercisesRouter.get("/mine", requireRole("ATHLETE"), async (req, res) => {
  const athlete = await prisma.athlete.findUniqueOrThrow({ where: { userId: req.user!.sub } });
  const rows = await prisma.exerciseAssignment.findMany({
    where: { athleteId: athlete.id },
    orderBy: { createdAt: "desc" },
    include: assignmentInclude,
  });
  res.json(rows.map(toAssignment));
});

exercisesRouter.get("/athlete/:athleteId", requireRole("COACH", "PHYSIO"), async (req, res) => {
  if (!(await inScope(req, req.params.athleteId))) {
    return res.status(404).json({ error: "Deportista no encontrado" });
  }
  const rows = await prisma.exerciseAssignment.findMany({
    where: { athleteId: req.params.athleteId },
    orderBy: { createdAt: "desc" },
    include: assignmentInclude,
  });
  res.json(rows.map(toAssignment));
});

exercisesRouter.post("/assignments", requireRole("PHYSIO"), async (req, res) => {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
  const { athleteId, exerciseId, dosage, note } = parsed.data;

  try {
    const outcome = await prisma.$transaction(async tx => {
      const athlete = await tx.athlete.findUnique({ where: { id: athleteId }, select: { id: true } });
      if (!athlete) return { error: "Deportista no encontrado" };
      const exercise = await tx.exercise.findFirst({ where: { id: exerciseId, archived: false }, select: { id: true } });
      if (!exercise) return { error: "Ejercicio no disponible" };
      const row = await tx.exerciseAssignment.create({
        data: { athleteId, exerciseId, dosage: dosage ?? null, note: note ?? null, assignedById: req.user!.sub },
        include: assignmentInclude,
      });
      return { row };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if ("error" in outcome) return res.status(404).json({ error: outcome.error });
    res.status(201).json(toAssignment(outcome.row));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") return res.status(409).json({ error: "Este ejercicio ya está asignado a este deportista" });
      if (error.code === "P2003" || error.code === "P2034") {
        return res.status(409).json({ error: "El ejercicio o el deportista cambió durante la operación. Inténtalo de nuevo" });
      }
    }
    throw error;
  }
});

exercisesRouter.delete("/assignments/:id", requireRole("PHYSIO"), async (req, res) => {
  const r = await prisma.exerciseAssignment.deleteMany({ where: { id: req.params.id } });
  if (r.count === 0) return res.status(404).json({ error: "Asignación no encontrada" });
  res.json({ ok: true });
});

// ===== Biblioteca =====

exercisesRouter.get("/", requireRole("COACH", "PHYSIO"), async (_req, res) => {
  const list = await prisma.exercise.findMany({
    where: { archived: false },
    orderBy: [{ component: "asc" }, { name: "asc" }],
    include: { _count: { select: { assignments: true } } },
  });
  res.json(list.map((e) => ({ ...toExercise(e), assigned: e._count.assignments })));
});

exercisesRouter.post("/", requireRole("PHYSIO"), async (req, res) => {
  const parsed = exerciseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Revisa los datos" });
  const { component, name, description, dosage, zone, mediaUrl } = parsed.data;
  const e = await prisma.exercise.create({
    data: {
      component, name,
      description: description ?? null, dosage: dosage ?? null, zone: zone ?? null, mediaUrl: mediaUrl ?? null,
    },
  });
  res.status(201).json({ ...toExercise(e), assigned: 0 });
});

exercisesRouter.patch("/:id", requireRole("PHYSIO"), async (req, res) => {
  const parsed = exerciseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Revisa los datos" });
  const { component, name, description, dosage, zone, mediaUrl } = parsed.data;

  const found = await prisma.exercise.findUnique({ where: { id: req.params.id } });
  if (!found) return res.status(404).json({ error: "Ejercicio no encontrado" });

  const e = await prisma.exercise.update({
    where: { id: found.id },
    data: {
      component, name,
      description: description ?? null, dosage: dosage ?? null, zone: zone ?? null, mediaUrl: mediaUrl ?? null,
    },
    include: { _count: { select: { assignments: true } } },
  });
  res.json({ ...toExercise(e), assigned: e._count.assignments });
});

// Si el ejercicio ya se usa (asignado o en el programa) se archiva; si no, se elimina
exercisesRouter.delete("/:id", requireRole("PHYSIO"), async (req, res) => {
  try {
    const archived = await prisma.$transaction(async tx => {
      const found = await tx.exercise.findUnique({ where: { id: req.params.id }, select: {
        id: true, archived: true, _count: { select: { assignments: true, sessions: true } },
      } });
      if (!found) return null;
      if (found.archived) return true;
      if (found._count.assignments || found._count.sessions) {
        await tx.exercise.update({ where: { id: found.id }, data: { archived: true } });
        return true;
      }
      await tx.exercise.delete({ where: { id: found.id } });
      return false;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (archived === null) return res.status(404).json({ error: "Ejercicio no encontrado" });
    res.json({ archived });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2003", "P2025", "P2034"].includes(error.code)) {
      return res.status(409).json({ error: "El ejercicio cambió durante la operación. Actualiza la biblioteca e inténtalo de nuevo" });
    }
    throw error;
  }
});
