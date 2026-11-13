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
  fullName: z.string().trim().min(2, "Escribe el nombre completo"),
    email: z.string().trim().toLowerCase().email("Escribe un correo válido"),
  // Los deportistas se registran solos (así queda su consentimiento informado)
  role: z.enum(["COACH", "PHYSIO", "ADMIN"]),
});

adminRouter.post("/users", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Revisa los datos del usuario" });
  const { fullName, email, role } = parsed.data;

  if (await prisma.user.findUnique({ where: { email } })) {
    return res.status(409).json({ error: "Ese correo ya está registrado" });
  }

  // Contraseña temporal: se muestra una sola vez al administrador
  const tempPassword = randomBytes(9).toString("base64url");
  const user = await prisma.user.create({
        data: { fullName, email, role, mustChangePassword: true, passwordHash: await bcrypt.hash(tempPassword, 12) },
    select: userSelect,
  });
  res.status(201).json({ user, tempPassword });
});

adminRouter.patch("/users/:id", async (req, res) => {
  const parsed = z.object({ active: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
  if (req.params.id === req.user!.sub) {
    return res.status(400).json({ error: "No puedes desactivar tu propia cuenta" });
  }
  const r = await prisma.user.updateMany({ where: { id: req.params.id }, data: { active: parsed.data.active } });
  if (r.count === 0) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json({ ok: true });
});

adminRouter.patch("/athletes/:id/coach", async (req, res) => {
  const parsed = z.object({ coachId: z.string().nullable() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });
  const { coachId } = parsed.data;

  if (coachId) {
    const coach = await prisma.user.findUnique({ where: { id: coachId } });
    if (!coach || coach.role !== "COACH" || !coach.active) {
      return res.status(400).json({ error: "Ese entrenador no está disponible" });
    }
  }
  const r = await prisma.athlete.updateMany({ where: { id: req.params.id }, data: { coachId } });
  if (r.count === 0) return res.status(404).json({ error: "Deportista no encontrado" });
  res.json({ ok: true });
});