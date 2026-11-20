import type { Request, Response } from "express";
import { z } from "zod";
import { calendarDay } from "../services/program";
import { ALERT_FILTERS } from "../services/alert-status";
import { buildTeamReport, MissingAthlete, REPORTS, ReportLimit } from "../services/team-report";

const date = z.string().date().refine(day => day >= "1900-01-01" && day <= "9999-12-30");
const filtersSchema = z.object({
  report: z.enum(REPORTS).default("all"),
  privacy: z.enum(["identified", "coded"]).optional(),
  anon: z.literal("1").optional(),
  athleteId: z.string().uuid().optional(),
  from: date.optional(),
  to: date.optional(),
  status: z.enum(ALERT_FILTERS).optional(),
}).strict().refine(f =>
  !(f.from && f.to && f.from > f.to) &&
  !(f.report === "athletes" && (f.from || f.to)) &&
  !(f.status && f.report !== "all" && f.report !== "alerts") &&
  !(f.anon && f.privacy === "identified")
);

let activeReports = 0;

export async function exportTeamReport(req: Request, res: Response) {
  res.setHeader("Cache-Control", "private, no-store");
  const parsed = filtersSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Revisa el periodo, el deportista y los filtros disponibles para este reporte." });
  if (activeReports >= 2) return res.status(429).json({ error: "Hay reportes en generación. Inténtalo de nuevo en unos instantes." });

  const { anon: _legacyPrivacy, ...query } = parsed.data;
  const privacy = query.privacy ?? "coded";
  const now = new Date();
  activeReports++;
  try {
    const book = await buildTeamReport({ ...query, privacy, now });
    const content = Buffer.from(await book.xlsx.writeBuffer());
    const mode = privacy === "coded" ? "seudonimizado" : "identificable";
    const name = `luchasegura_${query.report}_${mode}_${calendarDay(now)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    res.send(content);
  } catch (error) {
    if (error instanceof MissingAthlete) return res.status(404).json({ error: "Deportista no encontrado." });
    if (error instanceof ReportLimit) return res.status(422).json({ error: error.message });
    throw error;
  } finally {
    activeReports--;
  }
}
