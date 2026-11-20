import { calendarDay } from "../services/program";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../middleware/auth";
import { loginLimiter, recoveryLimiter, registerLimiter } from "../middleware/limits";

import { createPasswordRecovery, hashResetToken } from "../services/password-recovery";

export const authRouter = Router();
const recovery = createPasswordRecovery(process.env);

const emailRule = z.string().trim().toLowerCase().email("Escribe un correo válido");
const passwordRule = z
  .string()
  .min(10, "Mínimo 10 caracteres")
  .max(128, "Máximo 128 caracteres")
  .refine(p => Buffer.byteLength(p, "utf8") <= 72, "La contraseña supera el límite de 72 bytes")
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Debe incluir letras y números");

const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Revisa los datos";

// Se compara siempre contra un hash, exista o no el correo, para no revelar qué cuentas existen
const DUMMY_HASH = bcrypt.hashSync("contrasena-que-nadie-usa", 12);

type AuthUser = { id: string; fullName: string; role: string; mustChangePassword: boolean };

function signToken(user: { id: string; role: string; passwordChangedAt: Date | null; sessionsRevokedAt: Date | null }) {
  const options: SignOptions = {
    expiresIn: config.jwtExpiresIn as SignOptions["expiresIn"],
    algorithm: "HS256",
  };
  return jwt.sign({
    sub: user.id, role: user.role,
    pwd: user.passwordChangedAt?.getTime() ?? 0,
    rev: user.sessionsRevokedAt?.getTime() ?? 0,
  }, config.jwtSecret, options);
}

const sessionUser = (u: AuthUser) => ({
  id: u.id,
  fullName: u.fullName,
  role: u.role,
  mustChangePassword: u.mustChangePassword,
});

const ageOn = (birth: Date) => {
  const today = calendarDay(new Date());
  const day = birth.toISOString().slice(0, 10);
  return Number(today.slice(0, 4)) - Number(day.slice(0, 4)) - Number(today.slice(5) < day.slice(5));
};

// El registro público solo crea deportistas. Los demás roles los crea un administrador.
const registerSchema = z.object({
  email: emailRule,
  password: passwordRule,
  fullName: z.string().trim().min(2, "Escribe tu nombre completo").max(120),
  birthDate: z.string().date().transform(value => new Date(value))
    .refine((d) => d.toISOString().slice(0, 10) <= calendarDay(new Date()) && d >= new Date("1940-01-01"), "La fecha de nacimiento no es válida"),
  consent: z.object({
    textVersion: z.string().trim().min(1).max(40),
    guardianName: z.string().trim().max(120).optional(),
  }),
});

authRouter.post("/register", registerLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstError(parsed.error) });
  const { email, password, fullName, birthDate, consent } = parsed.data;

  if (ageOn(birthDate) < 18 && !consent.guardianName) {
    return res.status(400).json({ error: "Para menores de 18 años se requiere el nombre del acudiente" });
  }

  try {
    const user = await prisma.user.create({
      data: {
        email,
        fullName,
        role: "ATHLETE",
        passwordHash: await bcrypt.hash(password, 12),
        athlete: { create: { birthDate } },
        consents: { create: { textVersion: consent.textVersion, guardianName: consent.guardianName || undefined } },
      },
    });
    res.status(201).json({ id: user.id, email: user.email });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ error: "Ese correo ya está registrado" });
    }
    throw error;
  }
});

const loginSchema = z.object({ email: emailRule, password: z.string().min(1).max(128) });

authRouter.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.active || !ok) {
    return res.status(401).json({ error: "Correo o contraseña incorrectos" });
  }
  res.json({ token: signToken(user), user: sessionUser(user) });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, email: true, fullName: true, role: true, mustChangePassword: true },
  });
  res.json(user);
});

authRouter.post("/change-password", loginLimiter, requireAuth, async (req, res) => {
  const parsed = z
    .object({ currentPassword: z.string().min(1).max(128), newPassword: passwordRule })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstError(parsed.error) });
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.sub } });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return res.status(400).json({ error: "La contraseña actual no es correcta" });
  }
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    return res.status(400).json({ error: "La nueva contraseña debe ser distinta de la actual" });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const updated = await prisma.$transaction(async tx => {
    const now = nextPasswordVersion(user.passwordChangedAt);
    const [account] = await tx.user.updateManyAndReturn({
      where: {
        id: user.id, active: true, passwordHash: user.passwordHash, sessionsRevokedAt: user.sessionsRevokedAt,
      },
      data: { passwordHash, passwordChangedAt: now, mustChangePassword: false },
    });
    if (!account) return null;
    await tx.passwordResetToken.updateMany({ where: { userId: account.id, usedAt: null }, data: { usedAt: now } });
    return account;
  });
  if (!updated) return res.status(409).json({ error: "La cuenta cambió. Inicia sesión y vuelve a intentarlo." });
  res.json({ token: signToken(updated), user: sessionUser(updated) });
});

function nextPasswordVersion(previous: Date | null) {
  return new Date(Math.max(Date.now(), (previous?.getTime() ?? 0) + 1));
}

authRouter.post("/forgot-password", recoveryLimiter, async (req, res) => {
  const parsed = z.object({ email: emailRule }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Escribe un correo válido" });

  if (!recovery) return res.status(503).json({ error: "La recuperación por correo todavía no está disponible." });
  res.status(202).json({ message: "Si la cuenta puede usar la recuperación, recibirás instrucciones por correo." });
  recovery.request(parsed.data.email);
});

const resetToken = z.string().min(32).max(200);
const resetCheck = z.object({ token: resetToken }).strict();

authRouter.post("/reset-password/check", async (req, res) => {
  const input = resetCheck.safeParse(req.body);
  if (!input.success) return res.json({ valid: false });
  const { token } = input.data;
  const record = await prisma.passwordResetToken.findFirst({
    where: { tokenHash: hashResetToken(token), usedAt: null, expiresAt: { gt: new Date() }, user: { active: true } },
    select: { id: true },
  });
  res.json({ valid: !!record });
});

authRouter.post("/reset-password", recoveryLimiter, async (req, res) => {
  const parsed = z
    .object({ token: resetToken, password: passwordRule }).strict()
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstError(parsed.error) });

  const record = await prisma.passwordResetToken.findFirst({
    where: { tokenHash: hashResetToken(parsed.data.token), usedAt: null, expiresAt: { gt: new Date() }, user: { active: true } },
    select: { id: true, userId: true, user: { select: { passwordHash: true, passwordChangedAt: true } } },
  });
  const invalid = { error: "El enlace no es válido o ya venció. Solicita uno nuevo." };
  if (!record) return res.status(400).json(invalid);

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  try {
    await prisma.$transaction(async tx => {
      const now = nextPasswordVersion(record.user.passwordChangedAt);
      const updated = await tx.user.updateMany({
        where: { id: record.userId, active: true, passwordHash: record.user.passwordHash },
        data: { passwordHash, passwordChangedAt: now, mustChangePassword: false },
      });
      if (!updated.count) throw new ResetUnavailable();
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: now },
      });
      if (!claimed.count) throw new ResetUnavailable();
      await tx.passwordResetToken.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: now } });
    });
  } catch (error) {
    if (error instanceof ResetUnavailable) return res.status(400).json(invalid);
    throw error;
  }
  res.json({ message: "Contraseña actualizada" });
});

class ResetUnavailable extends Error {}
