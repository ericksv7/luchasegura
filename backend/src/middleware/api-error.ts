import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";

export function apiErrorHandler(err: Error & { status?: number; type?: string }, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);
  if (err.type === "entity.parse.failed" || err.type === "entity.too.large") {
    return res.status(err.status ?? 400).json({ error: "Solicitud inválida" });
  }
  // Prisma puede omitir el código al conectar por primera vez desde una consulta.
  const unavailable = err instanceof Prisma.PrismaClientInitializationError
    || (err instanceof Prisma.PrismaClientKnownRequestError
      && ["P1001", "P1002", "P1008", "P1017", "P2024"].includes(err.code));
  const status = unavailable ? 503 : 500;
  // No registrar el error de Prisma completo: puede contener filtros, campos clínicos o la conexión.
  console.error("Error de solicitud API", { method: req.method, status });
  res.status(status).json({ error: unavailable ? "El servicio de datos no está disponible temporalmente" : "Error interno del servidor" });
}
