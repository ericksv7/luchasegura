import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { calendarDay } from "../services/program";
import { groupReport, individualReport } from "../services/program-report";
import { buildProgramWorkbook } from "../services/reporting/program-workbook";

const filters = z.object({ programId: z.string().min(1).max(128), start: z.iso.date() }).strict()
  .or(z.object({}).strict());
const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
let activeExports = 0;

async function respond(req: Request, res: Response, group: boolean) {
  const query = (group ? z.object({}).strict() : filters).safeParse(req.query);
  if (!query.success) return res.status(400).json({ error: "Selecciona una intervención válida." });
  const exporting = req.path.endsWith(".xlsx");
  if (exporting && activeExports >= 2) return res.status(429).json({ error: "Hay informes en generación. Inténtalo de nuevo." });
  if (exporting) activeExports++;
  try {
    const now = new Date();
    const data = group ? await groupReport(req.user!, now)
      : await individualReport(req.user!, req.params.id, "start" in query.data ? query.data as { start: string; programId: string } : undefined, now);
    if (!data) return res.status(404).json({ error: "Intervención o deportista no disponible." });
    if (!exporting) return res.json(data);
    if (!data.report) return res.status(403).json({ error: "La exportación requiere un informe disponible." });
    const content = Buffer.from(await buildProgramWorkbook(data).xlsx.writeBuffer());
    return res.type(mime).attachment(`luchasegura_informe_${group ? "grupal" : "individual"}_${calendarDay(now)}.xlsx`).send(content);
  } finally {
    if (exporting) activeExports--;
  }
}

export const programReports = Router();
programReports.use(requireAuth);
programReports.get(["/me", "/me.xlsx"], requireRole("ATHLETE"), (req, res) => respond(req, res, false));
programReports.get(["/athletes/:id.xlsx", "/athletes/:id"], requireRole("PHYSIO"), (req, res) => respond(req, res, false));
programReports.get(["/group", "/group.xlsx"], requireRole("PHYSIO"), (req, res) => respond(req, res, true));
