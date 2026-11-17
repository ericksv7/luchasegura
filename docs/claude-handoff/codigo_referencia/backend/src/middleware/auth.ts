import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { config } from "../config";
import { prisma } from "../db";

export interface AuthPayload {
  sub: string;
  role: Role;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthPayload;
  }
}

// Mientras la cuenta tenga contraseña temporal, solo puede cambiarla
const ALLOWED_WHEN_MUST_CHANGE = ["/api/auth/change-password", "/api/auth/me"];

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autenticado" });
  }

  let payload: AuthPayload & { iat: number };
  try {
    payload = jwt.verify(header.slice(7), config.jwtSecret, { algorithms: ["HS256"] }) as AuthPayload & { iat: number };
  } catch {
    return res.status(401).json({ error: "Sesión inválida o vencida" });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { active: true, role: true, passwordChangedAt: true, mustChangePassword: true },
  });
  if (!user || !user.active) {
    return res.status(401).json({ error: "Sesión inválida o vencida" });
  }
  // Si la contraseña cambió después de emitir el token, la sesión ya no sirve
  if (user.passwordChangedAt && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    return res.status(401).json({ error: "Sesión inválida o vencida" });
  }
  if (user.mustChangePassword && !ALLOWED_WHEN_MUST_CHANGE.includes(req.originalUrl.split("?")[0])) {
    return res.status(403).json({
      error: "Debes cambiar tu contraseña antes de continuar",
      code: "PASSWORD_CHANGE_REQUIRED",
    });
  }

  req.user = { sub: payload.sub, role: user.role };
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "No tienes permiso para esta acción" });
    }
    next();
  };
}