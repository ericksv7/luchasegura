import { ValidatorFn } from '@angular/forms';

import { bogotaDay } from './civil-date';

// La fecha de nacimiento y el día de referencia son fechas civiles.
export function ageOf(iso: string, now = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const parsed = new Date(iso);
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== iso) return null;
  const today = bogotaDay(now);
  return Number(today.slice(0, 4)) - Number(iso.slice(0, 4)) - Number(today.slice(5) < iso.slice(5));
}

export const birthDateValidator: ValidatorFn = (control) => {
  const v = control.value as string;
  if (!v) return null;
  const a = ageOf(v);
  return a === null || a < 5 || a > 90 ? { invalidDate: true } : null;
};