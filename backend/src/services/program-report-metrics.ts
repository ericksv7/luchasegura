import { z } from "zod";
import { shiftDay } from "./preventive-survey";

const measurement = z.object({
  value: z.number().finite().nonnegative(),
  side: z.enum(["LEFT", "RIGHT"]).optional(),
  direction: z.string().trim().min(1).max(40).optional(),
  unit: z.enum(["cm", "s"]).optional(),
}).strict();
export const protocolCode = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/);
const result = z.object({ measurements: z.array(measurement).min(1).max(24), protocol: protocolCode.optional() }).strict();
export const instrumentNames = { SEBT: "SEBT", YBT: "YBT-LQ", T_TEST: "Agility T-test" } as const;
type Instrument = keyof typeof instrumentNames;
type Evaluation = {
  id: string; testType: string; phase: "INITIAL" | "FINAL"; version: number;
  revisions: { version: number; measuredOn: Date; result: unknown }[];
};

export function compareEvaluations(tests: Evaluation[], start: string, weeks: number, today: string) {
  return (Object.entries(instrumentNames) as [Instrument, string][]).map(([instrument, name]) => {
    const unit = instrument === "T_TEST" ? "s" : "cm";
    const records = tests.filter(test => test.testType === instrument).flatMap(test => {
      const latest = test.revisions[0];
      if (!latest || latest.version !== test.version || test.version < 1) return [];
      const parsed = result.safeParse(latest.result);
      const day = latest.measuredOn.toISOString().slice(0, 10);
      const rows = parsed.success ? parsed.data.measurements : [];
      const entries = rows.map(row => ({
        key: instrument === "T_TEST" ? "Tiempo" : [row.side === "LEFT" ? "Izquierda" : "Derecha", row.direction].join(" · "),
        value: row.value,
      }));
      const shape = rows.length > 0 && rows.every(row => (!row.unit || row.unit === unit) &&
        (instrument === "T_TEST" ? rows.length === 1 && row.value > 0 && !row.side && !row.direction : row.side && row.direction));
      const distinct = new Set(entries.map(row => row.key)).size === entries.length;
      return [{
        id: test.id, version: latest.version, phase: test.phase, day,
        protocol: parsed.success ? parsed.data.protocol ?? null : null,
        values: shape && distinct ? entries : [],
        inWindow: day <= today && (test.phase === "INITIAL"
          ? day >= shiftDay(start, -7) && day <= start
          : day >= shiftDay(start, weeks * 7)),
      }];
    }).sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id));
    const initial = records.filter(row => row.phase === "INITIAL" && row.inWindow);
    const final = records.filter(row => row.phase === "FINAL" && row.inWindow);
    const first = initial[0];
    const last = final[0];
    const compatible = initial.length === 1 && final.length === 1 && first.protocol &&
      first.protocol === last.protocol && first.values.length > 0 &&
      first.values.length === last.values.length && first.values.every(row => last.values.some(other => row.key === other.key));
    const changes = compatible ? first.values.map(row => {
      const ending = last.values.find(other => other.key === row.key)!.value;
      const absolute = ending - row.value;
      const percentage = row.value > 0 ? absolute / row.value * 100 : null;
      return { key: row.key, initial: row.value, final: ending, absolute,
        percentage: percentage !== null && Number.isFinite(percentage) ? percentage : null };
    }) : [];
    return { instrument, name, unit, records, changes };
  });
}

export function calculateParticipation(
  sessions: { id: string; week: number }[], completedIds: ReadonlySet<string>, weeks: number, reached: number,
) {
  const rows = Array.from({ length: weeks }, (_, index) => ({ week: index + 1, planned: 0, completed: 0 }));
  for (const session of sessions) {
    const row = rows[session.week - 1];
    if (!row) continue;
    row.planned++;
    if (session.week <= reached && completedIds.has(session.id)) row.completed++;
  }
  const due = rows.filter(row => row.week <= reached);
  const plannedToDate = due.reduce((sum, row) => sum + row.planned, 0);
  const completed = due.reduce((sum, row) => sum + row.completed, 0);
  return {
    planned: rows.reduce((sum, row) => sum + row.planned, 0), plannedToDate, completed,
    pending: plannedToDate - completed, weeksWithRecords: due.filter(row => row.completed > 0).length,
    adherence: plannedToDate > 0 ? completed / plannedToDate * 100 : null, rows,
  };
}
