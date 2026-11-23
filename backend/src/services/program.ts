import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { presentExercise } from './exercise';

export function calendarDay(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function currentWeek(start: Date | null, weeks: number, now = new Date()) {
  if (!start) return 0;
  const days = Math.floor((Date.parse(calendarDay(now)) - Date.parse(start.toISOString().slice(0, 10))) / 86400000);
  return days < 0 ? 0 : Math.min(weeks, Math.floor(days / 7) + 1);
}
export const programInclude = {
  sessions: { orderBy: [{ week: 'asc' }, { number: 'asc' }],
    include: { exercises: { orderBy: { position: 'asc' }, include: { exercise: true } } } }
} satisfies Prisma.ProgramInclude;
const currentProgramQuery = {
  where: { sessions: { some: {} } },
  orderBy: { id: 'asc' },
} satisfies Prisma.ProgramFindFirstArgs;

export function loadProgram(client: Pick<Prisma.TransactionClient, 'program'> = prisma) {
  return client.program.findFirst({ ...currentProgramQuery, include: programInclude });
}

export function loadProgramIdentity(client: Pick<Prisma.TransactionClient, 'program'> = prisma) {
  return client.program.findFirst({ ...currentProgramQuery, select: { id: true, weeks: true, name: true } });
}

export function loadProgramProgress(client: Pick<Prisma.TransactionClient, 'program'>, take: number) {
  return client.program.findFirst({
    ...currentProgramQuery,
    select: { id: true, name: true, weeks: true, sessions: { select: { id: true, week: true }, take } },
  });
}

type LoadedProgram = Prisma.ProgramGetPayload<{ include: typeof programInclude }>;
export function presentProgram(program: LoadedProgram, start: Date | null, done: Set<string>) {
  return {
    id: program.id, name: program.name, weeks: program.weeks, sessionsPerWeek: program.sessionsPerWeek,
    startedAt: start?.toISOString().slice(0, 10) ?? null, currentWeek: currentWeek(start, program.weeks),
    sessions: program.sessions.map(s => ({ id: s.id, week: s.week, number: s.number, minutes: s.minutes, done: done.has(s.id),
      exercises: s.exercises.map(e => presentExercise(e.exercise)) }))
  };
}

type ProgramLite = { weeks: number; sessions: { id: string; week: number }[] } | null;

export function progress(program: ProgramLite, startedAt: Date | null, doneIds: Set<string>, now = new Date()) {
  if (!program) return { week: 0, planned: 0, done: 0, compliance: 0 };
  const week = currentWeek(startedAt, program.weeks, now);
  const upto = program.sessions.filter((s) => s.week <= week);
  const done = upto.filter((s) => doneIds.has(s.id)).length;
  return {
    week,
    planned: upto.length,
    done,
    compliance: upto.length ? Math.round((done / upto.length) * 100) : 0,
  };
}
