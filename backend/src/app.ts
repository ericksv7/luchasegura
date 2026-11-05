import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";
import { athletesRouter } from "./routes/athletes";
import { injuriesRouter } from "./routes/injuries";

export const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/athletes", athletesRouter);
app.use("/api/injuries", injuriesRouter);
// TODO (cuando se definan los módulos): programas, sesiones, pruebas funcionales, panel y exportación

app.use((_req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});
