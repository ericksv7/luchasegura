import { rateLimit } from "express-rate-limit";

const base = { standardHeaders: true, legacyHeaders: false } as const;

export const generalLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 300,
  message: { error: "Demasiadas solicitudes. Espera un momento." },
});

// Solo cuentan los intentos fallidos
export const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: { error: "Demasiados intentos. Espera 15 minutos e inténtalo de nuevo." },
});

export const recoveryLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60_000,
  limit: 5,
  message: { error: "Demasiadas solicitudes de recuperación. Inténtalo en una hora." },
});

export const registerLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60_000,
  limit: 10,
  message: { error: "Demasiados registros desde esta conexión. Inténtalo más tarde." },
});