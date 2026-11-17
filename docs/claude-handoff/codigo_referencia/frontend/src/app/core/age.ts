import { ValidatorFn } from '@angular/forms';

// Edad a partir de una fecha 'AAAA-MM-DD'
export function ageOf(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const now = new Date();
  let a = now.getFullYear() - y;
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) a--;
  return a;
}

export const birthDateValidator: ValidatorFn = (control) => {
  const v = control.value as string;
  if (!v) return null;
  const a = ageOf(v);
  return a === null || a < 5 || a > 90 ? { invalidDate: true } : null;
};