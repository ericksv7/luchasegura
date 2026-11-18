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

  let payload: AuthPayload & { iat: number; pwd?: number };
  try {
    const verified = jwt.verify(header.slice(7), config.jwtSecret, { algorithms: ["HS256"] });
    if (typeof verified === "string" || typeof verified.sub !== "string" || !verified.sub ||
      typeof verified.iat !== "number" || typeof verified.exp !== "number") throw new Error("Token inválido");
    payload = verified as typeof payload;
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
  // Los tokens anteriores sin versión solo se aceptan si se emitieron después del segundo del cambio.
  const version = user.passwordChangedAt?.getTime() ?? 0;
  const stale = payload.pwd === undefined
    ? version > 0 && payload.iat <= Math.floor(version / 1000)
    : payload.pwd !== version;
  if (stale) {
    return res.status(401).json({ error: "Sesión inválida o vencida" });
  }
  if (user.mustChangePassword && !ALLOWED_WHEN_MUST_CHANGE.includes(req.originalUrl.split("?")[0])) {
    return res.status(403).json({
      error: "Debes cambiar tu contraseña antes de continuar",
      code: "PASSWORD_CHANGE_REQUIRED",
    });
  }

  if (payload.role !== user.role) {
    return res.status(403).json({ error: "El rol de tu cuenta cambió. Inicia sesión de nuevo", code: "ROLE_CHANGED" });
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