import { z } from "zod";
import { shiftDay } from "./preventive-survey";

export const baselineSchema = z.strictObject({
  version: z.literal("WEEK0-V1"),
  age: z.number().int().min(0).max(120).nullable(),
  weight: z.number().gt(0).max(500).nullable(),
  category: z.string().trim().min(1).max(60).nullable(),
  experience: z.number().int().min(0).max(100).nullable(),
  style: z.string().trim().min(1).max(60).nullable(),
  historyReviewed: z.boolean(),
}).refine(value => value.age === null || value.experience === null || value.experience <= value.age);

export const baselineInWindow = (day: string, start: Date | null) => {
  if (!start) return false;
  const civil = start.toISOString().slice(0, 10);
  return day >= shiftDay(civil, -7) && day <= civil;
};
