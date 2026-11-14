import { Request, Response } from "express";
import { rateLimit } from "express-rate-limit";

const base = { standardHeaders: true, legacyHeaders: false } as const;

// Responde con los segundos de espera para que la pantalla muestre la cuenta regresiva
function tooMany(message: string) {
  return (req: Request, res: Response) => {
    const info = (req as any).rateLimit as { resetTime?: Date } | undefined;
    const retryAfter = info?.resetTime
      ? Math.max(1, Math.ceil((info.resetTime.getTime() - Date.now()) / 1000))
      : 60;
    res.status(429).json({ error: message, retryAfter });
  };
}

export const generalLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 300,
  handler: tooMany("Demasiadas solicitudes. Espera un momento."),
});

// Solo cuentan los intentos fallidos
export const loginLimiter = rateLimit({
  ...base,
  windowMs: 5 * 60_000,
  limit: 10,
  skipSuccessfulRequests: true,
  handler: tooMany("Demasiados intentos."),
});

export const recoveryLimiter = rateLimit({
  ...base,
  windowMs: 10 * 60_000,
  limit: 5,
  handler: tooMany("Demasiadas solicitudes de recuperación."),
});

export const registerLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 10,
  handler: tooMany("Demasiados registros desde esta conexión."),
});