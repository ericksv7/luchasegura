import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../middleware/auth";
import { loginLimiter, recoveryLimiter, registerLimiter } from "../middleware/limits";

export const authRouter = Router();

const emailRule = z.string().trim().toLowerCase().email("Escribe un correo válido");
const passwordRule = z
  .string()
  .min(10, "Mínimo 10 caracteres")
  .max(128, "Máximo 128 caracteres")
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Debe incluir letras y números");

const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Revisa los datos";
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

// Se compara siempre contra un hash, exista o no el correo, para no revelar qué cuentas existen
const DUMMY_HASH = bcrypt.hashSync("contrasena-que-nadie-usa", 12);

type AuthUser = { id: string; fullName: string; role: string; mustChangePassword: boolean };

function signToken(user: { id: string; role: string }) {
  const options: SignOptions = {
    expiresIn: config.jwtExpiresIn as SignOptions["expiresIn"],
    algorithm: "HS256",
  };
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, options);
}

const sessionUser = (u: AuthUser) => ({
  id: u.id,
  fullName: u.fullName,
  role: u.role,
  mustChangePassword: u.mustChangePassword,
});

// El registro público solo crea deportistas. Los demás roles los crea un administrador.
const registerSchema = z.object({
  email: emailRule,
  password: passwordRule,
  fullName: z.string().trim().min(2, "Escribe tu nombre completo"),
  consent: z.object({
    textVersion: z.string(),
    guardianName: z.string().trim().optional(),
  }),
});

authRouter.post("/register", registerLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstError(parsed.error) });
  const { email, password, fullName, consent } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: "Ese correo ya está registrado" });

  const user = await prisma.user.create({
    data: {
      email,
      fullName,
      role: "ATHLETE",
      passwordHash: await bcrypt.hash(password, 12),
      athlete: { create: {} },
      consents: { create: consent },
    },
  });
  res.status(201).json({ id: user.id, email: user.email });
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

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, 12),
      passwordChangedAt: new Date(),
      mustChangePassword: false,
    },
  });
  // Las demás sesiones quedan cerradas; esta recibe un token nuevo
  res.json({ token: signToken(updated), user: sessionUser(updated) });
});

authRouter.post("/forgot-password", recoveryLimiter, async (req, res) => {
  const parsed = z.object({ email: emailRule }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Escribe un correo válido" });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user && user.active) {
    const now = new Date();
    await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } });
    // Un enlace nuevo invalida los anteriores
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    });
    const token = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
      },
    });
    const link = `${config.corsOrigin}/restablecer?token=${token}`;
    // TODO: enviar por correo (nodemailer). Por ahora, solo en desarrollo, se muestra en la consola.
    if (!config.isProd) {
      console.log(`[DEV] Enlace para restablecer la contraseña de ${user.email}:\n${link}`);
    }
  }
  // Misma respuesta exista o no el correo
  res.json({ message: "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña." });
});

authRouter.get("/reset-password/check", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (token.length < 32 || token.length > 200) return res.json({ valid: false });
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  res.json({ valid: !!record && !record.usedAt && record.expiresAt > new Date() });
});

authRouter.post("/reset-password", recoveryLimiter, async (req, res) => {
  const parsed = z
    .object({ token: z.string().min(32).max(200), password: passwordRule })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstError(parsed.error) });

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return res.status(400).json({ error: "El enlace no es válido o ya venció. Solicita uno nuevo." });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await bcrypt.hash(parsed.data.password, 12),
        passwordChangedAt: new Date(),
        mustChangePassword: false,
      },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);
  res.json({ message: "Contraseña actualizada" });
});