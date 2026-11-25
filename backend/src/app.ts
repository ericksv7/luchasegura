import { preventiveSurveys } from "./routes/preventive-surveys";
import { programReports } from "./routes/program-reports";
import "express-async-errors";
import express from "express";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import cors from "cors";
import helmet from "helmet";
import { apiErrorHandler } from "./middleware/api-error";
import { config } from "./config";
import { generalLimiter } from "./middleware/limits";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";
import { athletesRouter } from "./routes/athletes";
import { injuriesRouter } from "./routes/injuries";
import { programRouter } from "./routes/program";
import { teamRouter } from "./routes/team";
import { adminRouter } from "./routes/admin";
import { rulesRouter } from "./routes/rules";
import { alertReviewsRouter } from "./routes/alert-reviews";
import { exercisesRouter } from "./routes/exercises";

export const app = express();

app.disable("x-powered-by");
// Detrás de un proxy (al publicar) para que el límite de intentos vea la IP real
if (config.isProd && config.trustProxyHops) app.set("trust proxy", config.trustProxyHops);

const frontendDir = process.env.ANGULAR_BROWSER_DIR;
app.use(helmet(frontendDir ? { contentSecurityPolicy: { directives: {
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
} } } : {}));
if (!frontendDir) app.use(cors({
  origin: (origin, callback) => callback(null, origin === config.corsOrigin),
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  exposedHeaders: ["Content-Disposition"],
}));
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
}, generalLimiter);
app.use(express.json({ limit: "100kb" }));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/athletes", athletesRouter);
app.use("/api/injuries", injuriesRouter);
app.use("/api/program", programRouter);
app.use("/api/team/alerts", alertReviewsRouter);
app.use("/api/team", teamRouter);
app.use("/api/preventive-surveys", preventiveSurveys);
app.use("/api/program-reports", programReports);
app.use("/api/admin", adminRouter);
app.use("/api/rules", rulesRouter);
app.use("/api/exercises", exercisesRouter);

// Un endpoint inexistente de la API siempre devuelve JSON.
app.use("/api", (_req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

if (frontendDir) {
  const browserDir = resolve(frontendDir);
  const index = readFileSync(join(browserDir, "index.html"), "utf8");
  const page = process.env.PRESENTATION_NOTICE === "1"
    ? index.replace("</head>", '<meta name="luchasegura-presentation" content="1"></head>')
    : index;
  const sendIndex: express.RequestHandler = (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.type("html").send(page);
  };
  app.get("/index.html", sendIndex);
  app.use(express.static(browserDir, { index: false }));
  app.get("*", (req, res, next) => {
    if (!req.path.split("/").pop()?.includes(".") && req.accepts("html")) return sendIndex(req, res, next);
    next();
  });
}

app.use((_req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

app.use(apiErrorHandler);
