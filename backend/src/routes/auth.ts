import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../middleware/auth";

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
