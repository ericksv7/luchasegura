import { once } from "node:events";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import { app } from "../src/app";
import { seedProgramReports } from "./program-report-fixture";

export async function startReportSite(port = 0, interactiveDemo = false) {
  const dist = process.env.BROWSER_FRONTEND_DIST ?? resolve(__dirname, "../../frontend/dist/frontend/browser");
  const index = resolve(dist, "index.html");
  if (!existsSync(index)) throw new Error("Compila el frontend antes de iniciar la demostración.");
  const fixtures = await seedProgramReports(interactiveDemo);
  const site = express();
  site.use((req, res, next) => req.path.startsWith("/api/") ? app(req, res, next) : next());
  site.use(express.static(dist));
  site.get("*", (_req, res) => res.sendFile(index));
  const server = site.listen(port, "127.0.0.1");
  await once(server, "listening");
  return { server, fixtures, origin: `http://127.0.0.1:${(server.address() as { port: number }).port}` };
}
