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

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autenticado" });
  }

  let payload: AuthPayload;
  try {
    payload = jwt.verify(header.slice(7), config.jwtSecret) as AuthPayload;
  } catch {
    return res.status(401).json({ error: "Sesión inválida o vencida" });
  }

  try {
    // Se confirma en la base de datos que la cuenta siga activa y se usa su rol actual
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { active: true, role: true },
    });
    if (!user || !user.active) {
      return res.status(401).json({ error: "Sesión inválida o vencida" });
    }
    req.user = { sub: payload.sub, role: user.role };
    next();
  } catch (e) {
    next(e);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "No tienes permiso para esta acción" });
    }
    next();
  };
}