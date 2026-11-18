import type { Prisma } from '@prisma/client';
import { prisma } from '../db';

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
export function loadProgram() {
  return prisma.program.findFirst({
    where: { sessions: { some: {} } },
    orderBy: { id: 'asc' },
    include: programInclude,
  });
}

type LoadedProgram = Prisma.ProgramGetPayload<{ include: typeof programInclude }>;
export function presentProgram(program: LoadedProgram, start: Date | null, done: Set<string>) {
  return {
    id: program.id, name: program.name, weeks: program.weeks, sessionsPerWeek: program.sessionsPerWeek,
    startedAt: start?.toISOString().slice(0, 10) ?? null, currentWeek: currentWeek(start, program.weeks),
    sessions: program.sessions.map(s => ({ id: s.id, week: s.week, number: s.number, minutes: s.minutes, done: done.has(s.id),
      exercises: s.exercises.map(e => ({ name: e.exercise.name, component: e.exercise.component, dosage: e.exercise.dosage,
        description: e.exercise.description, mediaUrl: e.exercise.mediaUrl })) }))
  };
}
