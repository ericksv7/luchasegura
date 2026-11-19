import { Request, Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { presentExercise } from "../services/exercise";
import { requireAuth, requireRole } from "../middleware/auth";

export const exercisesRouter = Router();
exercisesRouter.use(requireAuth);

const COMPONENTS = ["Fuerza", "Core", "Movilidad"] as const;

const visibleExercises = {
  archived: false,
  component: { in: [...COMPONENTS] },
} satisfies Prisma.ExerciseWhereInput;

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

const illustrationField = z.preprocess(blankToNull, z.string().max(88_000).refine(
  value => /^\/exercises\/(?:cadera|toracica|hombro|plancha|lateral|puente|nordico|zancada|sentadilla|remo|pasos|altura|balanceo|equilibrio|salto|pantorrilla|press-pecho|peso-rumano|talones|escalon|apertura-banda|curl-banda|press-banda|rotacion-banda|sentadilla-libre|prensa|extension-rodilla|curl-femoral|flexiones|banca-barra|remo-mancuerna|remo-polea|jalon|press-militar|elevacion-lateral|curl-mancuerna|triceps-polea|abdominal-corto|dead-bug|tobillo-pared)\.svg$/.test(value)
    || /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value),
  "Usa una ilustración de la biblioteca o una imagen PNG, JPG o WebP de hasta 64 KB"
).nullable().optional());

const exerciseSchema = z.object({
  component: z.enum(COMPONENTS),
  name: z.string().trim().min(2, "Escribe el nombre del ejercicio").max(80),
  description: optText(600),
  dosage: optText(80),
  zone: optText(60),
  mediaUrl: mediaField,
  objective: optText(240),
  level: z.preprocess(blankToNull, z.enum(["Inicial", "Intermedio", "Avanzado"]).nullable().optional()),
  equipment: optText(140),
  instructions: optText(1500),
  mistakes: optText(400),
  precautions: optText(400),
  illustration: illustrationField,
});

const assignSchema = z.object({
  athleteId: z.string().min(1),
  exerciseId: z.string().min(1),
  dosage: optText(80),
  note: optText(300),
});

const catalogInclude = { _count: { select: { assignments: true, sessions: true } } } satisfies Prisma.ExerciseInclude;
type CatalogRow = Prisma.ExerciseGetPayload<{ include: typeof catalogInclude }>;
const toCatalogExercise = (exercise: CatalogRow) => ({
  ...presentExercise(exercise),
  assigned: exercise._count.assignments,
  inProgram: exercise._count.sessions > 0,
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
  exercise: presentExercise(a.exercise),
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
      const exercise = await tx.exercise.findFirst({ where: { id: exerciseId, ...visibleExercises }, select: { id: true } });
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
    where: visibleExercises,
    orderBy: [{ component: "asc" }, { name: "asc" }],
    include: catalogInclude,
  });
  res.json(list.map(toCatalogExercise));
});

exercisesRouter.post("/", requireRole("PHYSIO"), async (req, res) => {
  const parsed = exerciseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Revisa los datos" });
  const e = await prisma.exercise.create({
    data: parsed.data,
    include: catalogInclude,
  });
  res.status(201).json(toCatalogExercise(e));
});

exercisesRouter.patch("/:id", requireRole("PHYSIO"), async (req, res) => {
  const parsed = exerciseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Revisa los datos" });

  const found = await prisma.exercise.findUnique({ where: { id: req.params.id } });
  if (!found) return res.status(404).json({ error: "Ejercicio no encontrado" });

  const e = await prisma.exercise.update({
    where: { id: found.id },
    data: parsed.data,
    include: catalogInclude,
  });
  res.json(toCatalogExercise(e));
});

// Si el ejercicio ya se usa (asignado o en el programa) se archiva; si no, se elimina
exercisesRouter.delete("/:id", requireRole("PHYSIO"), async (req, res) => {
  try {
    const archived = await prisma.$transaction(async tx => {
      const found = await tx.exercise.findUnique({ where: { id: req.params.id }, select: {
        id: true, archived: true, isBase: true, _count: { select: { assignments: true, sessions: true } },
      } });
      if (!found) return null;
      if (found.archived) return true;
      if (found.isBase || found._count.assignments || found._count.sessions) {
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
