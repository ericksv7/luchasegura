import { Router } from "express";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN"));

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  active: true,
  createdAt: true,
  athlete: { select: { id: true, coachId: true } },
} satisfies Prisma.UserSelect;

adminRouter.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, select: userSelect });
  res.json(users);
});

const createSchema = z.object({
  fullName: z.string().trim().min(2, "Escribe el nombre completo").max(120),
  email: z.string().trim().toLowerCase().email("Escribe un correo válido"),
  // Los deportistas se registran solos (así queda su consentimiento informado)
  role: z.enum(["COACH", "PHYSIO", "ADMIN"]),
});

adminRouter.post("/users", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Revisa los datos del usuario" });
  const { fullName, email, role } = parsed.data;

  const tempPassword = 'Ls1-' + randomBytes(9).toString("base64url");
  try {
    const user = await prisma.user.create({
      data: { fullName, email, role, mustChangePassword: true, passwordHash: await bcrypt.hash(tempPassword, 12) },
      select: userSelect,
    });
    res.status(201).json({ user, tempPassword });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ error: "Ese correo ya está registrado" });
    }
    throw error;
  }
});

const editSchema = createSchema.partial().extend({ active: z.boolean().optional() }).strict()
  .refine(data => Object.keys(data).length > 0);

adminRouter.patch("/users/:id", async (req, res) => {
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
  const id = req.params.id;
  const fields = parsed.data;
  if (id === req.user!.sub && (fields.role || fields.active !== undefined)) {
    return res.status(400).json({ error: "No puedes cambiar el rol ni el estado de tu propia cuenta" });
  }
  try {
    const result = await prisma.$transaction(async tx => {
      const current = await tx.user.findUnique({ where: { id }, select: {
        role: true, email: true, active: true, sessionsRevokedAt: true, athlete: { select: { id: true } }, _count: { select: { coaching: true } },
      } });
      if (!current) return { status: 404, error: "Usuario no encontrado" };
      if (fields.role && current.role !== fields.role && (current.role === "ATHLETE" || current.athlete || current._count.coaching)) {
        return { status: 409, error: "El rol está vinculado a un perfil de deportista o a asignaciones de entrenador" };
      }
      const accountChanged = (fields.email !== undefined && fields.email !== current.email)
        || (fields.role !== undefined && fields.role !== current.role)
        || (fields.active !== undefined && fields.active !== current.active);
      const revokedAt = accountChanged ? new Date(Math.max(Date.now(), +(current.sessionsRevokedAt ?? 0) + 1)) : undefined;
      const user = await tx.user.update({ where: { id }, data: { ...fields, sessionsRevokedAt: revokedAt }, select: userSelect });
      if (revokedAt) {
        await tx.passwordResetToken.updateMany({ where: { userId: id, usedAt: null }, data: { usedAt: revokedAt } });
      }
      return { status: 200, user };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if ("error" in result) return res.status(result.status).json({ error: result.error });
    res.json(result.user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") return res.status(409).json({ error: "Ese correo ya está registrado" });
      if (error.code === "P2034") return res.status(409).json({ error: "La cuenta cambió durante la operación. Inténtalo de nuevo" });
    }
    throw error;
  }
});

adminRouter.patch("/athletes/:id/coach", async (req, res) => {
  const parsed = z.object({ coachId: z.string().nullable() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
  const { coachId } = parsed.data;

  try {
    const status = await prisma.$transaction(async tx => {
      if (coachId !== null && !(await tx.user.findFirst({ where: { id: coachId, role: "COACH", active: true } }))) return 400;
      const updated = await tx.athlete.updateMany({ where: { id: req.params.id }, data: { coachId } });
      if (!updated.count) return 404;
      await tx.sleepSharing.updateMany({
        where: { athleteId: req.params.id, revokedAt: null, ...(coachId === null ? {} : { coachId: { not: coachId } }) },
        data: { revokedAt: new Date() },
      });
      return 200;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (status === 400) return res.status(400).json({ error: "Ese entrenador no está disponible" });
    if (status === 404) return res.status(404).json({ error: "Deportista no encontrado" });
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return res.status(409).json({ error: "La asignación cambió durante la operación. Inténtalo de nuevo" });
    }
    throw error;
  }
});

adminRouter.delete("/users/:id", async (req, res) => {
  if (req.params.id === req.user!.sub) {
    return res.status(400).json({ error: "No puedes eliminar tu propia cuenta" });
  }
  try {
    const id = req.params.id;
    const r = await prisma.user.deleteMany({ where: {
      id, role: { not: "ATHLETE" }, athlete: { is: null }, coaching: { none: {} },
      consents: { none: {} }, assignedExercises: { none: {} }, alertEntries: { none: {} }, evaluationRevisions: { none: {} },
    } });
    if (!r.count) {
      if (!(await prisma.user.findUnique({ where: { id }, select: { id: true } }))) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      return res.status(409).json({ error: "La cuenta tiene registros protegidos. Puedes desactivarla para conservarlos" });
    }
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return res.status(409).json({ error: "La cuenta tiene registros protegidos. Puedes desactivarla para conservar la trazabilidad" });
    }
    throw error;
  }
});