import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../middleware/auth";
import { createHash, randomBytes } from "node:crypto";

export const authRouter = Router();

// El registro público solo crea deportistas. Los demás roles los crea un administrador.
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  fullName: z.string().min(2),
  consent: z.object({
    textVersion: z.string(),
    guardianName: z.string().optional(),
  }),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
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

const loginSchema = z.object({ email: z.string().email(), password: z.string() });

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const ok = user && user.active && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!user || !ok) return res.status(401).json({ error: "Correo o contraseña incorrectos" });

  const options: SignOptions = { expiresIn: config.jwtExpiresIn as SignOptions["expiresIn"] };
  const token = jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, options);
  res.json({ token, user: { id: user.id, fullName: user.fullName, role: user.role } });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, email: true, fullName: true, role: true },
  });
  res.json(user);
});

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

authRouter.post("/forgot-password", async (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Escribe un correo válido" });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user && user.active) {
    const token = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    const link = `${config.corsOrigin}/restablecer?token=${token}`;
    // TODO: enviar por correo (nodemailer). Por ahora, solo en desarrollo, se muestra en la consola.
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV] Enlace para restablecer la contraseña de ${user.email}:\n${link}`);
    }
  }
  // Misma respuesta exista o no el correo, para no revelar qué cuentas existen
  res.json({ message: "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña." });
});

authRouter.get("/reset-password/check", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (token.length < 32) return res.json({ valid: false });
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  res.json({ valid: !!record && !record.usedAt && record.expiresAt > new Date() });
});

authRouter.post("/reset-password", async (req, res) => {
  const parsed = z
    .object({ token: z.string().min(32), password: z.string().min(8, "Mínimo 8 caracteres") })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return res.status(400).json({ error: "El enlace no es válido o ya venció. Solicita uno nuevo." });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await bcrypt.hash(parsed.data.password, 12) },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);
  res.json({ message: "Contraseña actualizada" });
});