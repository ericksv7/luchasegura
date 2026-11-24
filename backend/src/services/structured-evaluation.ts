import { z } from "zod";

export const fmsPatterns = [
  { sides: 1, clearing: 0 }, { sides: 2, clearing: 0 }, { sides: 2, clearing: 0 },
  { sides: 2, clearing: 2 }, { sides: 2, clearing: 0 },
  { sides: 1, clearing: 1 }, { sides: 2, clearing: 1 },
] as const;
export const fmsProtocol = "FMS-COOK-2014";
export const lessProtocol = "LESS-17-MEAN3";
const score = (max: number) => z.number().int().min(0).max(max).nullable();

const fms = z.strictObject({
  version: z.literal(fmsProtocol),
  patterns: z.array(z.strictObject({
    scores: z.array(score(3)).max(2),
    clearing: z.array(z.boolean().nullable()).max(2),
  })).length(fmsPatterns.length),
}).refine(({ patterns }) => patterns.every((row, i) =>
  row.scores.length === fmsPatterns[i].sides && row.clearing.length === fmsPatterns[i].clearing));

const less = z.strictObject({
  version: z.literal(lessProtocol),
  trials: z.array(z.array(score(2)).length(17)).length(3),
}).refine(({ trials }) => trials.every(items => items.every((value, i) => value === null || value <= (i < 15 ? 1 : 2))));

export const assessmentInput = z.union([fms, less]);
export function isStructuredInstrument(instrument: string): instrument is "FMS" | "LESS" {
  return instrument === "FMS" || instrument === "LESS";
}

export function scoreAssessment(instrument: string, candidate: unknown) {
  if (instrument === "FMS") {
    const parsed = fms.safeParse(candidate);
    if (!parsed.success) return null;
    const patterns = parsed.data.patterns.map(({ scores, clearing }) => {
      const pain = scores.includes(0) || clearing.includes(true);
      const complete = !scores.includes(null) && !clearing.includes(null);
      const asymmetry = scores.length === 2 && !scores.includes(null) && scores[0] !== scores[1];
      return { pain, complete, asymmetry, score: pain ? 0 : complete ? Math.min(...scores as number[]) : null };
    });
    const complete = patterns.every(row => row.complete);
    return { assessment: parsed.data, complete, pain: patterns.some(row => row.pain), patterns,
      total: complete ? patterns.reduce((sum, row) => sum + row.score!, 0) : null };
  }
  if (instrument === "LESS") {
    const parsed = less.safeParse(candidate);
    if (!parsed.success) return null;
    const trials = parsed.data.trials.map(items => items.includes(null) ? null :
      items.reduce<number>((sum, value) => sum + (value ?? 0), 0));
    const complete = !trials.includes(null);
    return { assessment: parsed.data, complete, trials,
      total: complete ? trials.reduce<number>((sum, value) => sum + (value ?? 0), 0) / trials.length : null };
  }
  return null;
}
