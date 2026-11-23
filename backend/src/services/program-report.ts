import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { calendarDay, currentWeek, loadProgramIdentity } from "./program";
import { hasSurveyConsent, shiftDay } from "./preventive-survey";
import { documentedWellbeingScope } from "./wellbeing-access";
import { calculateParticipation, compareEvaluations } from "./program-report-metrics";

type Tx = Prisma.TransactionClient;
type Actor = { sub: string; role: string };
export type Selection = { programId: string; start: string };
const civil = (date: Date) => date.toISOString().slice(0, 10);
const date = (day: string) => new Date(day);
const bogotaMidnight = (day: string) => new Date(day + "T00:00:00-05:00");
const same = (a: Selection, b: Selection) => a.programId === b.programId && a.start === b.start;
export const denominatorDefinition = "Sesiones del calendario registrado hasta la semana alcanzada en Bogotá. Completadas en el intervalo de la intervención.";
export const groupRestriction = "La divulgación grupal con datos reales requiere una regla institucional aprobada. Los agregados están disponibles en la demostración sintética aislada.";
export const descriptiveNote = "Los cambios se describen en las unidades registradas. Los reportes reflejan lo documentado durante el periodo y la cobertura de los registros.";

const surveySnapshot = z.object({
  reference: z.object({ from: z.iso.date(), to: z.iso.date() }),
  questions: z.array(z.object({ id: z.string(), label: z.string(), type: z.string(), options: z.array(z.tuple([z.string(), z.string()])).optional() })),
});
const answerMap = z.record(z.string(), z.unknown());
type Survey = { kind: string; catalogue: unknown; catalogueVersion: string; submittedAt: Date | null; version: number;
  revisions: { version: number; answers: unknown }[] };
function surveySummary(rows: Survey[]) {
  const initial = rows.find(row => row.kind === "INITIAL");
  const final = rows.find(row => row.kind === "FINAL");
  const submitted = (item: Survey | undefined) => item?.submittedAt?.toISOString() ?? null;
  const phases = [initial, final].map(item => {
    const parsed = surveySnapshot.safeParse(item?.catalogue);
    return { submitted: submitted(item), reference: submitted(item) && parsed.success ? parsed.data.reference : null };
  });
  const comparisons: { question: string; initial: string; final: string }[] = [];
  const a = surveySnapshot.safeParse(initial?.catalogue);
  const b = surveySnapshot.safeParse(final?.catalogue);
  const first = answerMap.safeParse(initial?.revisions[0]?.answers);
  const last = answerMap.safeParse(final?.revisions[0]?.answers);
  if (initial?.submittedAt && final?.submittedAt && initial.catalogueVersion === final.catalogueVersion &&
      initial.version === initial.revisions[0]?.version && final.version === final.revisions[0]?.version &&
      a.success && b.success && first.success && last.success &&
      Date.parse(a.data.reference.to) - Date.parse(a.data.reference.from) === Date.parse(b.data.reference.to) - Date.parse(b.data.reference.from) &&
      a.data.reference.to < b.data.reference.from) {
    for (const question of a.data.questions) {
      if (question.type !== "choice" || !question.options) continue;
      const other = b.data.questions.find(value => value.id === question.id);
      if (!other || other.type !== question.type || other.label !== question.label ||
          JSON.stringify(other.options) !== JSON.stringify(question.options)) continue;
      const early = question.options.find(([key]) => key === first.data[question.id]);
      const late = question.options.find(([key]) => key === last.data[question.id]);
      if (early && late) comparisons.push({ question: question.label, initial: early[1], final: late[1] });
    }
  }
  return { initial: phases[0], final: phases[1], comparisons };
}

function authorizedAthletes(actor: Actor): Prisma.AthleteWhereInput {
  return { user: { active: true, role: "ATHLETE" }, ...(actor.role === "ATHLETE"
    ? { userId: actor.sub }
    : documentedWellbeingScope(actor.sub)) };
}

export async function individualReport(actor: Actor, athleteId: string | undefined, requested: Selection | undefined, now: Date) {
  return prisma.$transaction(async tx => {
    const athlete = await tx.athlete.findFirst({
      where: { ...authorizedAthletes(actor), ...(athleteId ? { id: athleteId } : {}) },
      select: { id: true, userId: true, birthDate: true, programStartedAt: true, surveyConsent: true, user: { select: { fullName: true } } },
    });
    if (!athlete) return null;
    const current = await loadProgramIdentity(tx);
    const currentKey = current && athlete.programStartedAt ? { programId: current.id, start: civil(athlete.programStartedAt) } : null;
    const canReadSurveys = hasSurveyConsent(athlete, now);
    const scope = { athleteId: athlete.id };
    const program = { select: { id: true, name: true, weeks: true } } as const;
    const [pastTests, pastWellbeing, pastSurveys] = await Promise.all([
      tx.functionalTest.findMany({ where: { ...scope, version: { gt: 0 }, interventionStartedAt: { not: null }, programId: { not: null } },
        distinct: ["programId", "interventionStartedAt"], select: { program, interventionStartedAt: true } }),
      tx.wellbeingEntry.findMany({ where: scope, distinct: ["programId", "startedOn"], select: { program, startedOn: true } }),
      canReadSurveys ? tx.preventiveSurvey.findMany({ where: { ...scope, respondentId: athlete.userId, submittedAt: { not: null } },
        distinct: ["programId", "startedOn"], select: { program, startedOn: true } }) : [],
    ]);
    const choices = new Map<string, Selection & { name: string; weeks: number; current: boolean }>();
    const add = (entry: { id: string; name: string; weeks: number } | null, started: Date | null) => {
      if (!entry || !started || !Number.isInteger(entry.weeks) || entry.weeks < 1 || entry.weeks > 52) return;
      const key = { programId: entry.id, start: civil(started) };
      choices.set(JSON.stringify(key), { ...key, name: entry.name, weeks: entry.weeks, current: !!currentKey && same(currentKey, key) });
    };
    add(current, athlete.programStartedAt);
    for (const entry of pastTests) add(entry.program, entry.interventionStartedAt);
    for (const entry of [...pastWellbeing, ...pastSurveys]) add(entry.program, entry.startedOn);
    const interventions = [...choices.values()].sort((a, b) => b.start.localeCompare(a.start) || a.programId.localeCompare(b.programId));
    const selected = requested ? interventions.find(entry => same(entry, requested)) : interventions.find(entry => entry.current) ?? interventions[0];
    if (requested && !selected) return null;
    const identity = { athlete: { name: athlete.user.fullName }, interventions, generatedAt: now.toISOString() };
    if (!selected) return { ...identity, report: null };

    const today = calendarDay(now);
    const end = shiftDay(selected.start, selected.weeks * 7);
    const through = today < end ? today : shiftDay(end, -1);
    const period = { gte: bogotaMidnight(selected.start), lt: new Date(Math.min(now.getTime(), bogotaMidnight(shiftDay(through, 1)).getTime())) };
    const linked = { ...scope, programId: selected.programId, startedOn: date(selected.start) };
    const otherCycle = interventions.some(entry => !same(entry, selected) &&
      entry.start < end && shiftDay(entry.start, entry.weeks * 7) > selected.start);
    const [sessions, completed, tests, injuries, wellbeing, surveys] = await Promise.all([
      selected.current ? tx.programSession.findMany({ where: { programId: selected.programId }, select: { id: true, week: true } }) : [],
      selected.current && !otherCycle ? tx.completedSession.findMany({ where: { ...scope, doneAt: period, session: { programId: selected.programId } },
        select: { sessionId: true } }) : [],
      tx.functionalTest.findMany({ where: { ...scope, programId: selected.programId, interventionStartedAt: date(selected.start), version: { gt: 0 } },
        select: { id: true, testType: true, phase: true, version: true, revisions: { orderBy: { version: "desc" }, take: 1,
          select: { version: true, measuredOn: true, result: true } } } }),
      otherCycle ? [] : tx.injury.findMany({ where: { ...scope, isHistory: false, occurredAt: period },
        orderBy: [{ occurredAt: "asc" }, { id: "asc" }], select: { id: true, bodyZone: true, occurredAt: true,
          alerts: { orderBy: { id: "asc" }, select: { status: true, entries: { where: { createdAt: { lte: now } }, orderBy: { version: "asc" },
            select: { kind: true, status: true, createdAt: true } } } } } }),
      tx.wellbeingEntry.findMany({ where: { ...linked, day: { gte: date(selected.start), lte: date(through) } },
        orderBy: { day: "asc" }, select: { day: true, version: true, revisions: { orderBy: { version: "desc" }, take: 1,
          select: { version: true, sleepTenths: true, fatigue: true, recovery: true } } } }),
      canReadSurveys ? tx.preventiveSurvey.findMany({ where: { ...linked, kind: { in: ["INITIAL", "FINAL"] },
        respondentId: athlete.userId, submittedAt: { lte: now } }, select: { kind: true, catalogue: true, catalogueVersion: true,
          submittedAt: true, version: true, revisions: { orderBy: { version: "desc" }, take: 1, select: { version: true, answers: true } } } }) : [],
    ]);
    const reached = currentWeek(date(selected.start), selected.weeks, now);
    const participation = selected.current && !otherCycle
      ? calculateParticipation(sessions, new Set(completed.map(row => row.sessionId)), selected.weeks, reached) : null;
    const observations = wellbeing.flatMap(entry => {
      const revision = entry.revisions[0];
      if (!revision || revision.version !== entry.version) return [];
      return [{ day: civil(entry.day), sleepHours: revision.sleepTenths === null ? null : revision.sleepTenths / 10,
        fatigue: revision.fatigue, recovery: revision.recovery }];
    });
    const zones = new Map<string, number>();
    const reports = injuries.map(row => {
      zones.set(row.bodyZone, (zones.get(row.bodyZone) ?? 0) + 1);
      return { id: row.id, zone: row.bodyZone, day: calendarDay(row.occurredAt), alerts: row.alerts.map(alert => ({
        status: alert.status, events: alert.entries.map(entry => ({ kind: entry.kind, status: entry.status, day: calendarDay(entry.createdAt) })),
      })) };
    });
    return { ...identity, report: {
      intervention: selected, plannedEnd: end, through: today >= selected.start ? through : null,
      status: today < selected.start ? "SCHEDULED" : today >= end ? "PERIOD_ENDED" : "ACTIVE",
      participation, denominatorDefinition, descriptiveNote,
      evaluations: compareEvaluations(tests, selected.start, selected.weeks, today),
      discomfort: otherCycle ? null : { reports, zones: [...zones].map(([zone, count]) => ({ zone, count })) },
      wellbeing: observations,
      surveys: canReadSurveys ? surveySummary(surveys) : null,
    } };
  }, { isolationLevel: "RepeatableRead" });
}

async function syntheticDatabase(tx: Tx) {
  if (process.env.NODE_ENV !== "test" || process.env.ALERT_REVIEW_TESTS !== "1" || process.env.PROGRAM_REPORTS_DEMO !== "1") return false;
  const [target] = await tx.$queryRaw<{ db: string; directory: string; address: string }[]>`
    SELECT current_database() AS db, current_setting('data_directory') AS directory, host(inet_server_addr()) AS address
  `;
  return target?.db === "luchasegura_alert_test" && target.address === "127.0.0.1" &&
    /^\/tmp\/luchasegura-alert-tests-[^/]+\/data$/.test(target.directory);
}

export function groupReport(actor: Actor, now: Date) {
  return prisma.$transaction(async tx => {
    const summary = { generatedAt: now.toISOString(), restriction: groupRestriction };
    if (!await syntheticDatabase(tx)) return { ...summary, report: null };
    const program = await loadProgramIdentity(tx);
    if (!program || program.weeks < 1 || program.weeks > 52) return { ...summary, report: null };
    const today = calendarDay(now);
    const athletes = await tx.athlete.findMany({ where: { ...authorizedAthletes(actor), programStartedAt: { lte: date(today) } },
      select: {
        programStartedAt: true,
        completed: { where: { session: { programId: program.id } }, select: { doneAt: true, sessionId: true } },
        tests: { where: { programId: program.id, version: { gt: 0 }, interventionStartedAt: { not: null } },
          select: { id: true, testType: true, phase: true, version: true, interventionStartedAt: true,
            revisions: { orderBy: { version: "desc" }, take: 1, select: { version: true, measuredOn: true, result: true } } } },
        wellbeing: { where: { programId: program.id, day: { lte: date(today) } }, select: { startedOn: true, day: true, version: true,
          revisions: { orderBy: { version: "desc" }, take: 1, select: { version: true } } } },
        injuries: { where: { isHistory: false, occurredAt: { lte: now } }, select: { occurredAt: true } },
      },
    });
    const sessions = await tx.programSession.findMany({ where: { programId: program.id }, select: { id: true, week: true } });
    let ended = 0, completed = 0, planned = 0, calculable = 0;
    let initial = 0, final = 0, comparable = 0, discomfort = 0, wellbeingCoverage = 0;
    let unambiguous = 0;
    for (const athlete of athletes) {
      const start = civil(athlete.programStartedAt!);
      const end = shiftDay(start, program.weeks * 7);
      if (today >= end) ended++;
      const overlapping = [...athlete.tests.map(row => row.interventionStartedAt!), ...athlete.wellbeing.map(row => row.startedOn)]
        .some(value => {
          const other = civil(value);
          return other !== start && other < end && shiftDay(other, program.weeks * 7) > start;
        });
      const evaluations = compareEvaluations(athlete.tests.filter(row => civil(row.interventionStartedAt!) === start), start, program.weeks, today);
      initial += Number(evaluations.some(item => item.records.some(row => row.phase === "INITIAL" && row.inWindow && row.values.length)));
      final += Number(evaluations.some(item => item.records.some(row => row.phase === "FINAL" && row.inWindow && row.values.length)));
      comparable += evaluations.filter(item => item.changes.length).length;
      wellbeingCoverage += Number(athlete.wellbeing.some(row => civil(row.startedOn) === start && civil(row.day) >= start &&
        civil(row.day) < end && row.revisions[0]?.version === row.version));
      if (overlapping) continue;
      unambiguous++;
      discomfort += athlete.injuries.filter(row => {
        const day = calendarDay(row.occurredAt);
        return day >= start && day < end;
      }).length;
      const ids = new Set(athlete.completed.filter(row => {
        const day = calendarDay(row.doneAt);
        return day >= start && day < end && day <= today;
      }).map(row => row.sessionId));
      const participation = calculateParticipation(sessions, ids, program.weeks, currentWeek(date(start), program.weeks, now));
      completed += participation.completed;
      planned += participation.plannedToDate;
      if (participation.adherence !== null) calculable++;
    }
    return { ...summary, report: { program: program.name, through: today, athletes: athletes.length, active: athletes.length - ended,
      ended, planned, completed, calculable, initial, final, comparable, discomfort, wellbeingCoverage, unambiguous, adherence: planned ? completed / planned * 100 : null, denominatorDefinition } };
  }, { isolationLevel: "RepeatableRead" });
}
