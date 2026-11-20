import { NextFunction, Request, Response } from "express";
import { createHash } from "node:crypto";
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

export function readSession(header?: string) {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some(part =>
    !part || Buffer.from(part, "base64url").toString("base64url") !== part
  )) return null;

  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
    if (typeof payload === "string" || typeof payload.sub !== "string" || !payload.sub ||
        typeof payload.iat !== "number" || !Number.isSafeInteger(payload.exp)) return null;
    const expiresAt = new Date(payload.exp! * 1000);
    if (!Number.isFinite(expiresAt.getTime())) return null;
    return { payload: { sub: payload.sub, iat: payload.iat, role: payload.role, pwd: payload.pwd, rev: payload.rev }, expiresAt, digest: createHash("sha256").update(token).digest("hex") };
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = readSession(req.headers.authorization);
  if (!session || await prisma.revokedSession.findUnique({
    where: { digest: session.digest }, select: { digest: true },
  })) {
    return res.status(401).json({ error: "Sesión inválida o vencida" });
  }
  const { payload } = session;
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { active: true, role: true, passwordChangedAt: true, sessionsRevokedAt: true, mustChangePassword: true },
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
  if ((payload.rev ?? 0) !== (user.sessionsRevokedAt?.getTime() ?? 0)) {
    return res.status(401).json({ error: "Sesión inválida o vencida" });
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