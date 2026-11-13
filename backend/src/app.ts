import "express-async-errors";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { generalLimiter } from "./middleware/limits";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";
import { athletesRouter } from "./routes/athletes";
import { injuriesRouter } from "./routes/injuries";
import { programRouter } from "./routes/program";
import { teamRouter } from "./routes/team";
import { adminRouter } from "./routes/admin";

export const app = express();

app.disable("x-powered-by");
// Detrás de un proxy (al publicar) para que el límite de intentos vea la IP real
if (config.isProd) app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({ origin: config.corsOrigin, methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] }));
app.use(express.json({ limit: "100kb" }));
app.use("/api", generalLimiter);

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/athletes", athletesRouter);
app.use("/api/injuries", injuriesRouter);
app.use("/api/program", programRouter);
app.use("/api/team", teamRouter);
app.use("/api/admin", adminRouter);

app.use((_req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  if (err.type === "entity.parse.failed" || err.type === "entity.too.large") {
    return res.status(err.status ?? 400).json({ error: "Solicitud inválida" });
  }
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});