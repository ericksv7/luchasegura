import { assertIsolatedDatabase, assertIsolatedEnvironment } from './isolated-database';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { prisma } from '../src/db';
import { config } from '../src/config';
import { Role } from '@prisma/client';
import type { Server } from 'node:http';

assertIsolatedEnvironment();
let server: Server, base: string;
const users = {} as Record<Role, string>;
let athleteId: string;
before(async () => {
  await assertIsolatedDatabase(prisma);
  for (const role of ['ATHLETE', 'COACH', 'PHYSIO', 'ADMIN'] as Role[]) {
    const u = await prisma.user.create({ data: { email: `${role}-${randomUUID()}@example.test`, fullName: `Prueba ${role}`, passwordHash: 'test-only', role } });
    users[role] = u.id;
  }
  const athlete = await prisma.athlete.create({ data: { userId: users.ATHLETE, coachId: users.COACH } });
  athleteId = athlete.id;
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as {port: number}).port}`;
});
after(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect(); });
async function request(method: string, path: string, role: Role | null = 'PHYSIO', body?: unknown) {
  const token = role ? jwt.sign({ sub: users[role], role }, config.jwtSecret, { expiresIn: '1h' }) : null;
  const response = await fetch(`${base}/api${path}`, { method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() as any };
}
async function freshAlert() {
  const injury = await prisma.injury.create({ data: { athleteId, bodyZone: 'Zona de prueba', intensity: 7, mechanism: 'Mecanismo introducido para prueba', notes: 'Reporte de prueba' } });
  return prisma.alert.create({ data: { injuryId: injury.id } });
}
function review(version = 0, followUp = false) {
  return { kind: 'REVIEW', requestId: randomUUID(), expectedVersion: version,
    observations: 'Observaciones de prueba', actionTaken: 'Actuación de prueba', findings: 'Hallazgos de prueba',
    recommendations: 'Indicaciones de prueba', referral: 'Remisión de prueba',
    followUpRequired: followUp, followUpDate: followUp ? '2027-01-15' : null };
}

test('la migración conserva la alerta antigua sin inventar documentación', async () => {
  const old = await prisma.alert.findUniqueOrThrow({ where: { id: '00000000-0000-4000-8000-000000000004' }, include: { entries: true } });
  assert.equal(old.status, 'REVIEWED'); assert.equal(old.version, 0); assert.deepEqual(old.entries, []);
});

test('solo PHYSIO consulta y escribe revisiones, incluso el administrador queda excluido', async () => {
  const a = await freshAlert();
  for (const role of ['ATHLETE', 'COACH', 'ADMIN', null] as const) {
    const denied = role ? 403 : 401;
    assert.equal((await request('GET', `/team/alerts/${a.id}`, role)).status, denied);
    assert.equal((await request('GET', '/team/alerts?status=ALL', role)).status, denied);
    assert.equal((await request('POST', `/team/alerts/${a.id}/review`, role, review())).status, denied);
  }
  assert.equal(await prisma.alertEntry.count({ where: { alertId: a.id } }), 0);
});

test('valida contenido, fechas y versiones; el endpoint antiguo vacío no cierra alertas', async () => {
  const a = await freshAlert();
  for (const body of [{}, { ...review(), observations: '  ' }, { ...review(), actionTaken: '' },
    { ...review(), followUpDate: '2027-02-30', followUpRequired: true },
    { ...review(), followUpDate: '2027-01-15', followUpRequired: false },
    { ...review(), expectedVersion: -1 }, { ...review(), diagnosis: 'No admitido' }]) {
    assert.equal((await request('POST', `/team/alerts/${a.id}/review`, 'PHYSIO', body)).status, 400);
  }
  assert.equal((await prisma.alert.findUniqueOrThrow({ where: { id: a.id } })).status, 'NEW');
  assert.equal(await prisma.alertEntry.count({ where: { alertId: a.id } }), 0);
});

test('registra revisión, seguimiento y reapertura como historial inmutable y actualiza pendientes', async () => {
  const a = await freshAlert();
  const post = (body: unknown) => request('POST', `/team/alerts/${a.id}/review`, 'PHYSIO', body);
  const started = await post({ kind: 'START', requestId: randomUUID(), expectedVersion: 0 });
  assert.equal(started.status, 201); assert.equal(started.data.status, 'IN_REVIEW');
  assert.equal((await post(review(1, true))).data.status, 'FOLLOW_UP_PENDING');
  let overview = await request('GET', '/team/overview');
  assert.ok(!overview.data.alerts.some((x: any) => x.id === a.id));
  assert.ok(overview.data.followUps.some((x: any) => x.id === a.id));
  const first = await prisma.alertEntry.findFirstOrThrow({ where: { alertId: a.id, kind: 'REVIEW' } });
  assert.equal(first.authorId, users.PHYSIO); assert.equal(first.authorName, 'Prueba PHYSIO'); assert.ok(first.createdAt);
  assert.equal(first.followUpDate!.toISOString().slice(0, 10), '2027-01-15');
  assert.equal((await post(review(2))).data.status, 'REVIEWED');
  overview = await request('GET', '/team/overview');
  assert.ok(!overview.data.alerts.some((x: any) => x.id === a.id));
  assert.equal((await post(review(3))).status, 409);
  assert.equal((await post({ kind: 'REOPEN', requestId: randomUUID(), expectedVersion: 3, observations: 'Motivo de reapertura de prueba' })).data.status, 'IN_REVIEW');
  assert.equal((await post(review(4))).status, 201);
  const detail = await request('GET', `/team/alerts/${a.id}`);
  assert.equal(detail.status, 200); assert.equal(detail.data.alert.entries.length, 5);
  assert.equal(detail.data.report.mechanism, 'Mecanismo introducido para prueba');
  assert.deepEqual(await prisma.alertEntry.findUniqueOrThrow({ where: { id: first.id } }), first);
  assert.ok(!JSON.stringify(detail.data).includes('passwordHash'));
});

test('los reintentos concurrentes son idempotentes; no admiten otra carga con la misma clave', async () => {
  const a = await freshAlert(); const body = review();
  const responses = await Promise.all([1, 2, 3].map(() => request('POST', `/team/alerts/${a.id}/review`, 'PHYSIO', body)));
  assert.ok(responses.every(r => r.status === 200 || r.status === 201));
  assert.equal(new Set(responses.map(r => r.data.id)).size, 1);
  assert.equal(await prisma.alertEntry.count({ where: { alertId: a.id } }), 1);
  assert.equal((await prisma.alert.findUniqueOrThrow({ where: { id: a.id } })).version, 1);
  assert.equal((await request('POST', `/team/alerts/${a.id}/review`, 'PHYSIO', { ...body, observations: 'Otro contenido' })).status, 409);
});

test('dos revisiones distintas sobre la misma versión no se sobrescriben ni guardan parcialmente', async () => {
  const a = await freshAlert();
  const r = await Promise.all([review(), review(0, true)].map(b => request('POST', `/team/alerts/${a.id}/review`, 'PHYSIO', b)));
  assert.deepEqual(r.map(x => x.status).sort(), [201, 409]);
  assert.equal(await prisma.alertEntry.count({ where: { alertId: a.id } }), 1);
  assert.equal((await prisma.alert.findUniqueOrThrow({ where: { id: a.id } })).version, 1);
});

test('el deportista y el entrenador ven estados sin notas profesionales; no se borra el historial', async () => {
  const a = await freshAlert();
  await request('POST', `/team/alerts/${a.id}/review`, 'PHYSIO', review());
  const mine = await request('GET', '/injuries/mine', 'ATHLETE');
  const report = mine.data.find((x: any) => x.id === a.injuryId);
  assert.deepEqual(report.alerts, [{ id: a.id, status: 'REVIEWED', hasReview: true }]);
  assert.ok(!JSON.stringify(mine.data).includes('Observaciones de prueba'));
  const coach = await request('GET', `/team/athletes/${athleteId}`, 'COACH');
  assert.equal(coach.status, 200); assert.ok(!JSON.stringify(coach.data).includes('Actuación de prueba'));
  assert.equal((await request('DELETE', `/injuries/${a.injuryId}`, 'ATHLETE')).status, 409);
  assert.equal((await request('DELETE', `/admin/users/${users.ATHLETE}`, 'ADMIN')).status, 409);
  assert.equal((await request('DELETE', `/admin/users/${users.PHYSIO}`, 'ADMIN')).status, 409);
  assert.equal(await prisma.alertEntry.count({ where: { alertId: a.id } }), 1);
});

test('el reporte del deportista genera una alerta según la regla existente y admite revisión persistente', async () => {
  await prisma.alertRule.create({ data: { bodyZone: 'Zona E2E', minIntensity: 5, createdById: users.PHYSIO } });
  const reported = await request('POST', '/injuries', 'ATHLETE', { bodyZone: 'Zona E2E', intensity: 6 });
  assert.equal(reported.status, 201);
  const a = await prisma.alert.findFirstOrThrow({ where: { injuryId: reported.data.id } });
  assert.equal((await request('POST', `/team/alerts/${a.id}/review`, 'PHYSIO', review())).status, 201);
  assert.equal((await request('GET', `/team/alerts/${a.id}`)).data.alert.entries[0].observations, 'Observaciones de prueba');
});

test('la baja adherencia se cuenta separadamente de las alertas clínicas pendientes', async () => {
  await prisma.athlete.update({ where: {id: athleteId}, data: {programStartedAt: new Date('2026-01-01')} });
  await prisma.program.create({ data: { name: 'Programa exclusivo de prueba', weeks: 1, sessionsPerWeek: 1,
    sessions: { create: { week: 1, number: 1 } } } });
  const actualPending = await prisma.alert.count({ where: { status: { in: ['NEW', 'IN_REVIEW'] } } });
  const overview = await request('GET', '/team/overview');
  assert.equal(overview.status, 200);
  assert.ok(overview.data.stats.lowAdherence > 0);
  assert.equal(overview.data.stats.newAlerts, actualPending);
  const row = overview.data.athletes.find((a: any) => a.id === athleteId);
  const patientAlerts = await prisma.alert.count({ where: { injury: { athleteId }, status: { in: ['NEW', 'IN_REVIEW'] } } });
  assert.equal(row.lowAdherence, true); assert.equal(row.newAlerts, patientAlerts);
});

test('el rol declarado en el token no concede acceso si el usuario real es administrador', async () => {
  const a = await freshAlert();
  const token = jwt.sign({ sub: users.ADMIN, role: 'PHYSIO' }, config.jwtSecret, { expiresIn: '1h' });
  const result = await fetch(`${base}/api/team/alerts/${a.id}`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(result.status, 403);
});

test('los reportes sin revisión mantienen el borrado permitido y las alertas inexistentes devuelven 404', async () => {
  const a = await freshAlert();
  assert.equal((await request('DELETE', `/injuries/${a.injuryId}`, 'ATHLETE')).status, 200);
  assert.equal((await request('GET', `/team/alerts/${a.id}`)).status, 404);
  assert.equal((await request('POST', `/team/alerts/${a.id}/review`, 'PHYSIO', review())).status, 404);
});


test('regresión: revisión y seguimiento tienen listas y contadores diferentes; reabrir repone pendientes', async () => {
  const a = await freshAlert(), b = await freshAlert();
  const before = (await request('GET', '/team/overview')).data.stats;
  const post = (id: string, body: unknown) => request('POST', `/team/alerts/${id}/review`, 'PHYSIO', body);
  assert.equal((await post(a.id, review())).data.status, 'REVIEWED');
  let pending = (await request('GET', '/team/alerts?status=PENDING')).data;
  assert.ok(!pending.some((x: any) => x.id === a.id));
  assert.ok((await request('GET', '/team/alerts?status=REVIEWED')).data.some((x: any) => x.id === a.id));
  assert.equal((await request('GET', '/team/overview')).data.stats.newAlerts, before.newAlerts - 1);
  assert.equal((await post(b.id, review(0, true))).data.status, 'FOLLOW_UP_PENDING');
  pending = (await request('GET', '/team/alerts')).data;
  assert.ok(!pending.some((x: any) => x.id === b.id));
  const followUps = (await request('GET', '/team/alerts?status=FOLLOW_UP_PENDING')).data;
  assert.ok(followUps.some((x: any) => x.id === b.id));
  let overview = (await request('GET', '/team/overview')).data;
  assert.equal(overview.stats.newAlerts, before.newAlerts - 2);
  assert.equal(overview.stats.followUpAlerts, before.followUpAlerts + 1);
  assert.ok(overview.followUps.some((x: any) => x.id === b.id));
  assert.equal((await post(b.id, { kind: 'START', expectedVersion: 1, requestId: randomUUID() })).data.status, 'FOLLOW_UP_PENDING');
  assert.equal((await request('GET', '/team/overview')).data.stats.newAlerts, before.newAlerts - 2);
  assert.equal((await post(b.id, review(2))).data.status, 'REVIEWED');
  overview = (await request('GET', '/team/overview')).data;
  assert.equal(overview.stats.newAlerts, before.newAlerts - 2);
  assert.equal(overview.stats.followUpAlerts, before.followUpAlerts);
  assert.equal((await post(a.id, { kind: 'REOPEN', observations: 'Reapertura de prueba', expectedVersion: 1, requestId: randomUUID() })).data.status, 'IN_REVIEW');
  pending = (await request('GET', '/team/alerts')).data;
  assert.ok(pending.some((x: any) => x.id === a.id));
  assert.equal((await request('GET', '/team/overview')).data.stats.newAlerts, before.newAlerts - 1);
  assert.equal((await request('GET', `/team/alerts/${b.id}`)).data.alert.entries.length, 3);
  // Otra petición autenticada lee los estados persistidos; no dependen de una sesión o caché.
  assert.ok((await request('GET', '/team/alerts?status=ALL')).data.some((x: any) => x.id === b.id && x.status === 'REVIEWED'));
});

test('finalizar seguimiento reutiliza REVIEWED y conserva autor, fecha e historial sin duplicados', async () => {
  const a = await freshAlert();
  await request('POST', `/team/alerts/${a.id}/review`, 'PHYSIO', review(0, true));
  const first = await prisma.alertEntry.findFirstOrThrow({ where: { alertId: a.id } });
  const before = (await request('GET', '/team/overview')).data.stats.followUpAlerts;
  const final = { ...review(1), observations: 'Motivo ficticio de finalización del seguimiento' };
  assert.equal((await request('POST', `/team/alerts/${a.id}/review`, 'PHYSIO', { ...final, observations: '' })).status, 400);
  assert.equal((await request('POST', `/team/alerts/${a.id}/review`, 'COACH', final)).status, 403);
  assert.equal((await request('POST', `/team/alerts/${a.id}/review`, 'ADMIN', final)).status, 403);
  const saved = await request('POST', `/team/alerts/${a.id}/review`, 'PHYSIO', final);
  assert.equal(saved.status, 201); assert.equal(saved.data.status, 'REVIEWED');
  assert.equal(saved.data.previousStatus, 'FOLLOW_UP_PENDING');
  assert.equal(saved.data.authorId, users.PHYSIO); assert.ok(saved.data.createdAt);
  assert.equal(saved.data.observations, final.observations);
  assert.equal((await request('POST', `/team/alerts/${a.id}/review`, 'PHYSIO', final)).status, 200);
  assert.equal(await prisma.alertEntry.count({ where: { alertId: a.id } }), 2);
  assert.deepEqual(await prisma.alertEntry.findUniqueOrThrow({ where: { id: first.id } }), first);
  assert.equal((await request('GET', '/team/overview')).data.stats.followUpAlerts, before - 1);
  assert.ok(!(await request('GET', '/team/alerts')).data.some((x: any) => x.id === a.id));
});

test('la ficha consulta evaluaciones persistidas sin exponerlas a otros roles ni calcular resultados', async () => {
  const result = { registro: 'Resultado de prueba almacenado por el profesional' };
  const initial = await prisma.functionalTest.create({ data: { athleteId, testType: 'Instrumento de prueba', phase: 'INITIAL', result } });
  const final = await prisma.functionalTest.create({ data: { athleteId, testType: 'Instrumento de prueba', phase: 'FINAL', result } });
  for (const role of ['ATHLETE', 'COACH', 'ADMIN', null] as const) {
    assert.equal((await request('GET', `/team/athletes/${athleteId}/evaluations`, role)).status, role ? 403 : 401);
  }
  const response = await request('GET', `/team/athletes/${athleteId}/evaluations`);
  assert.equal(response.status, 200);
  assert.equal(response.data.protocolStatus, 'AWAITING_VALIDATION');
  assert.equal(response.data.tests.find((t: any) => t.id === initial.id).phase, 'INITIAL');
  assert.equal(response.data.tests.find((t: any) => t.id === final.id).phase, 'FINAL');
  assert.deepEqual(response.data.tests.find((t: any) => t.id === initial.id).result, result);
  assert.equal((await request('GET', `/team/athletes/${randomUUID()}/evaluations`)).status, 404);
});

test('el inicio de intervención es explícito, protegido y no altera las sesiones históricas', async () => {
  const path = `/team/athletes/${athleteId}/program-start`;
  const legacy = await prisma.athlete.findUniqueOrThrow({ where: { id: '00000000-0000-4000-8000-000000000002' } });
  assert.equal(legacy.programStartedAt, null);
  for (const role of ['COACH', 'ADMIN', 'ATHLETE', null] as const) {
    assert.equal((await request('PATCH', path, role, {startedAt: '2026-01-01', expectedStartedAt: null})).status, role ? 403 : 401);
  }
  const before = await prisma.completedSession.count({ where: {athleteId} });
  const start = (await prisma.athlete.findUniqueOrThrow({where: {id:athleteId}})).programStartedAt?.toISOString().slice(0, 10) ?? null;
  assert.equal((await request('PATCH', path, 'PHYSIO', {startedAt:'2026-02-30',expectedStartedAt:start})).status,400);
  assert.equal((await request('PATCH', path, 'PHYSIO', {startedAt:'2026-01-02',expectedStartedAt:start})).status,200);
  assert.equal((await request('PATCH', path, 'PHYSIO', {startedAt:'2026-01-03',expectedStartedAt:start})).status,409);
  const detail = await request('GET', `/team/athletes/${athleteId}`);
  assert.equal(detail.data.program.startedAt, '2026-01-02');
  const ownProgram = await request('GET','/program/current','ATHLETE');
  assert.equal(ownProgram.data.startedAt,detail.data.program.startedAt);
  assert.equal(ownProgram.data.currentWeek,detail.data.program.currentWeek);
  assert.equal((await request('GET','/team/athletes/00000000-0000-4000-8000-000000000002','COACH')).status,404);
  assert.ok(Array.isArray(detail.data.program.sessions));
  assert.equal(await prisma.completedSession.count({where:{athleteId}}),before);
  const session = await prisma.programSession.findFirstOrThrow();
  await prisma.completedSession.create({data:{athleteId,sessionId:session.id,doneAt:new Date('2026-02-01T12:00:00Z')}});
  assert.equal((await request('PATCH',path,'PHYSIO',{startedAt:'2026-02-02',expectedStartedAt:'2026-01-02'})).status,400);
});

test('las semanas se cuentan desde la intervención por días de Bogotá, no desde la cuenta', async () => {
  const { currentWeek } = await import('../src/services/program');
  const start = new Date('2026-11-01');
  assert.equal(currentWeek(null,8,new Date('2026-11-15T12:00:00Z')),0);
  assert.equal(currentWeek(start,8,new Date('2026-11-01T04:59:00Z')),0);
  assert.equal(currentWeek(start,8,new Date('2026-11-01T05:00:00Z')),1);
  assert.equal(currentWeek(start,8,new Date('2026-11-08T04:59:00Z')),1);
  assert.equal(currentWeek(start,8,new Date('2026-11-08T05:00:00Z')),2);
  assert.equal(currentWeek(start,8,new Date('2027-01-15T12:00:00Z')),8);
  const noStart = await request('GET','/team/overview');
  const row = noStart.data.athletes.find((a: any)=>a.id==='00000000-0000-4000-8000-000000000002');
  assert.equal(row.week,0); assert.equal(row.planned,0); assert.equal(row.lowAdherence,false);
});

test('los indicadores de Alertas cuentan estados reales, respetan el filtro y los permisos', async () => {
  for (const role of ['ATHLETE','COACH','ADMIN',null] as const) assert.equal((await request('GET','/team/alerts/counts',role)).status,role?403:401);
  assert.equal((await request('GET','/team/alerts/counts?athleteId=incorrecto')).status,400);
  const alert=await freshAlert(), path=`/team/alerts/counts?athleteId=${athleteId}`;
  const before=(await request('GET',path)).data;
  assert.equal(before.total,await prisma.alert.count({where:{injury:{athleteId}}}));
  await request('POST',`/team/alerts/${alert.id}/review`,'PHYSIO',review(0,true));
  const follow=(await request('GET',path)).data;
  assert.equal(follow.pending,before.pending-1);assert.equal(follow.followUps,before.followUps+1);assert.equal(follow.total,before.total);
  await request('POST',`/team/alerts/${alert.id}/review`,'PHYSIO',review(1,false));
  const finished=(await request('GET',path)).data;
  assert.equal(finished.followUps,before.followUps);assert.equal(finished.reviewed,before.reviewed+1);assert.equal(finished.total,before.total);
  assert.equal(finished.total,finished.pending+finished.followUps+finished.reviewed);
});

test('la sesión confirmada se refleja en el plan y la ficha y los reintentos conservan el resultado', async () => {
  const plan = await request('GET', '/program/current', 'ATHLETE');
  assert.equal(plan.status, 200);
  const session = plan.data.sessions[0];
  const path = `/program/sessions/${session.id}/toggle`;
  assert.equal((await request('POST', path, 'PHYSIO', { done: true })).status, 403);
  assert.equal((await request('POST', path, 'ATHLETE', { done: 'true' })).status, 400);
  for (const done of [true, false]) {
    const responses = await Promise.all([1, 2, 3].map(() => request('POST', path, 'ATHLETE', { done })));
    for (const response of responses) assert.deepEqual(response, { status: 200, data: { done } });
    assert.equal(await prisma.completedSession.count({ where: { athleteId, sessionId: session.id } }), Number(done));
    const athletePlan = await request('GET', '/program/current', 'ATHLETE');
    assert.equal(athletePlan.data.sessions[0].done, done);
    for (const role of ['COACH', 'PHYSIO'] as const) {
      const detail = await request('GET', `/team/athletes/${athleteId}`, role);
      assert.equal(detail.data.program.id, athletePlan.data.id);
      assert.equal(detail.data.done, Number(done));
    }
  }
});

test('el registro simultáneo con el mismo correo crea un solo deportista', async () => {
  const email = `registro-${randomUUID()}@example.test`;
  const data = { email, fullName: 'Registro de prueba', password: 'Registro-prueba-2026',
    birthDate: '2000-01-01', consent: { textVersion: 'v0.2-borrador', accepted: true } };
  const responses = await Promise.all([1, 2].map(() => request('POST', '/auth/register', null, data)));
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
  const athlete = await prisma.athlete.findFirstOrThrow({ where: { user: { email } } });
  assert.equal(athlete.birthDate?.toISOString().slice(0, 10), data.birthDate);
});

test('Fase 2 A: administración edita cuentas, conserva relaciones y exige renovar sesión al cambiar de rol', async () => {
  const email = `personal-${randomUUID()}@example.test`;
  const body = { fullName: 'Personal de prueba', email, role: 'COACH' };
  const create = () => request('POST', '/admin/users', 'ADMIN', body);
  assert.equal((await request('POST', '/admin/users', 'PHYSIO', body)).status, 403);
  const results = await Promise.all([create(), create()]);
  assert.deepEqual(results.map(x => x.status).sort(), [201, 409]);
  const { user, tempPassword } = results.find(x => x.status === 201)!.data;
  const login = (password: string) => request('POST', '/auth/login', null, { email, password });
  const first = await login(tempPassword);
  assert.equal(first.data.user.mustChangePassword, true);
  const asUser = (path: string, token: string, body?: unknown) => fetch(base + '/api' + path, {
    method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal((await asUser('/team/overview', first.data.token)).status, 403);
  const password = 'Personal-Prueba-2026';
  const updatedLogin = await asUser('/auth/change-password', first.data.token, { currentPassword: tempPassword, newPassword: password });
  assert.equal(updatedLogin.status, 200);
  const { token } = await updatedLogin.json() as { token: string };
  const path = `/admin/users/${user.id}`;
  const assignment = `/admin/athletes/${athleteId}/coach`;
  assert.equal((await request('PATCH', assignment, 'ADMIN', { coachId: users.PHYSIO })).status, 400);
  assert.equal((await request('PATCH', assignment, 'ADMIN', { coachId: user.id })).status, 200);
  assert.equal((await prisma.athlete.findUniqueOrThrow({ where: { id: athleteId } })).coachId, user.id);
  assert.equal((await request('PATCH', path, 'ADMIN', { role: 'PHYSIO' })).status, 409);
  assert.equal((await request('DELETE', path, 'ADMIN')).status, 409);
  assert.equal((await request('DELETE', `/admin/users/${users.ATHLETE}`, 'ADMIN')).status, 409);
  assert.equal((await request('PATCH', assignment, 'ADMIN', { coachId: null })).status, 200);
  assert.equal((await request('PATCH', assignment, 'ADMIN', { coachId: users.COACH })).status, 200);
  const edited = await request('PATCH', path, 'ADMIN', { fullName: 'Personal actualizado', role: 'PHYSIO' });
  assert.equal(edited.data.fullName, 'Personal actualizado');
  assert.equal(edited.data.role, 'PHYSIO');
  assert.equal((await asUser('/team/overview', token)).status, 403);
  const current = await login(password);
  assert.equal(current.data.user.role, 'PHYSIO');
  assert.equal((await asUser('/team/alerts/counts', current.data.token)).status, 200);
  assert.equal((await request('PATCH', path, 'ADMIN', { active: false })).data.active, false);
  assert.equal((await login(password)).status, 401);
  assert.equal((await request('PATCH', path, 'ADMIN', { active: true })).data.active, true);
  assert.equal((await login(password)).status, 200);
  assert.equal((await request('GET', '/admin/users', 'ADMIN')).data.find((row: any) => row.id === user.id).fullName, 'Personal actualizado');
  assert.equal((await request('DELETE', path, 'ADMIN')).status, 200);
  assert.equal(await prisma.user.count({ where: { id: user.id } }), 0);
});

test('Fase 2 B y E: perfil, antecedentes y reporte con reintento, revisión e historial protegido', async () => {
  assert.equal((await request('PUT', '/athletes/me', 'ATHLETE', { weightKg: 70, coachId: null })).status, 400);
  assert.equal((await request('PUT', '/athletes/me', 'ATHLETE', { weightKg: 70, notes: 'Nota privada de perfil' })).status, 200);
  assert.equal((await request('GET', '/athletes/me', 'ATHLETE')).data.weightKg, '70');
  const history = await request('POST', '/injuries', 'ATHLETE', { isHistory: true, bodyZone: 'Rodilla', injuryType: 'Dato privado' });
  assert.equal(history.status, 201);
  const historyPath = `/injuries/${history.data.id}/history`;
  assert.equal((await request('PATCH', historyPath, 'PHYSIO', { bodyZone: 'Rodilla' })).status, 403);
  assert.equal((await request('PATCH', historyPath, 'ATHLETE', { bodyZone: 'Rodilla', occurredAt: '2026-02-30' })).status, 400);
  assert.equal((await request('PATCH', historyPath, 'ATHLETE', { bodyZone: 'Rodilla', daysAbsent: 2 })).data.daysAbsent, 2);

  const zone = 'Zona de flujo funcional';
  assert.equal((await request('POST', '/rules', 'PHYSIO', { bodyZone: zone, minIntensity: 6 })).status, 201);
  const payload = { requestId: randomUUID(), bodyZone: zone, intensity: 6, notes: 'Nota privada de reporte' };
  const sent = await Promise.all([1, 2].map(() => request('POST', '/injuries', 'ATHLETE', payload)));
  assert.deepEqual(sent.map(x => x.status).sort(), [200, 201]);
  assert.ok(sent.every(x => x.data.id === payload.requestId && x.data.alerts.length === 1));
  assert.equal((await request('POST', '/injuries', 'ATHLETE', { ...payload, notes: 'Otro envío' })).status, 409);
  assert.equal((await request('PATCH', `/injuries/${payload.requestId}/history`, 'ATHLETE', { bodyZone: zone })).status, 404);
  const alerts = await prisma.alert.findMany({ where: { injuryId: payload.requestId } });
  assert.equal(alerts.length, 1);
  const alert = alerts[0];
  const detail = await request('GET', `/team/athletes/${athleteId}`, 'PHYSIO');
  assert.ok(detail.data.injuries.some((row: any) => row.id === history.data.id && row.daysAbsent === 2));
  const coach = await request('GET', `/team/athletes/${athleteId}`, 'COACH');
  assert.equal(coach.data.profile.notes, null);
  const coachList = await request('GET', '/athletes', 'COACH');
  assert.ok(coachList.data.some((row: any) => row.id === athleteId));
  assert.ok(coachList.data.every((row: any) => !('notes' in row)));
  assert.equal(coach.data.injuries.find((row: any) => row.id === payload.requestId).notes, null);
  assert.ok(!coach.data.injuries.some((row: any) => row.id === history.data.id));
  assert.equal((await request('GET', '/team/export', 'COACH')).status, 403);
  const reviewPath = `/team/alerts/${alert.id}/review`;
  assert.equal((await request('POST', reviewPath, 'COACH', review(0, true))).status, 403);
  assert.equal((await request('POST', reviewPath, 'PHYSIO', { ...review(0, true), followUpDate: null })).status, 201);
  const followUps = await request('GET', '/team/alerts?status=FOLLOW_UP_PENDING');
  assert.ok(followUps.data.some((row: any) => row.id === alert.id && row.followUpDate === null));
  assert.equal((await request('DELETE', `/injuries/${payload.requestId}`, 'ATHLETE')).status, 409);
  assert.equal((await request('POST', reviewPath, 'PHYSIO', review(1))).status, 201);
  const log = (await request('GET', `/team/alerts/${alert.id}`)).data.alert.entries;
  assert.equal(log.length, 2);
  assert.ok(log.every((entry: any) => entry.authorId === users.PHYSIO && entry.createdAt));
  assert.equal((await request('GET', '/injuries/mine', 'ATHLETE')).data.find((row: any) => row.id === payload.requestId).alerts[0].status, 'REVIEWED');
  assert.equal((await request('DELETE', `/injuries/${history.data.id}`, 'ATHLETE')).status, 200);
  assert.equal((await request('PUT', '/athletes/me', 'ATHLETE', { weightKg: null, notes: null })).data.weightKg, null);
});

test('la biblioteca base se carga y conserva los datos de ejercicios previos', async () => {
  const list = (await request('GET', '/exercises', 'COACH')).data as any[];
  const library = list.filter(exercise => exercise.isBase);
  assert.equal(library.length, 29);
  assert.deepEqual([...new Set(list.map(exercise => exercise.component))].sort(), ['Core', 'Fuerza', 'Movilidad']);
  assert.equal(library.filter(exercise => exercise.component === 'Fuerza').length, 24);
  for (const exercise of library) {
    for (const field of ['objective', 'zone', 'level', 'equipment', 'description', 'instructions', 'mistakes', 'precautions']) {
      assert.ok(exercise[field], `${exercise.name}: ${field}`);
    }
    assert.match(exercise.illustration, /^\/exercises\/[a-z-]+\.svg$/);
  }
  assert.ok(!list.some(exercise => ['base-salto', 'legacy-bridge-fixture', 'legacy-technique-fixture'].includes(exercise.id)));
  const jump = await prisma.exercise.findUniqueOrThrow({ where: { id: 'base-salto' } });
  assert.equal(jump.archived, true);
  const bridge = await prisma.exercise.findUniqueOrThrow({ where: { id: 'legacy-bridge-fixture' } });
  assert.equal(bridge.archived, true);
  const technique = await prisma.exercise.findUniqueOrThrow({ where: { id: 'legacy-technique-fixture' } });
  assert.equal(technique.archived, false);
  const historical = (await request('GET', '/exercises/athlete/00000000-0000-4000-8000-000000000002')).data;
  assert.equal(historical[0].exercise.id, bridge.id);
  assert.equal(historical[0].note, 'Indicación anterior');
  assert.equal((await request('POST', '/exercises/assignments', 'PHYSIO', { athleteId, exerciseId: technique.id })).status, 404);
  assert.equal(library.find(exercise => exercise.id === 'base-rotacion-banda').component, 'Fuerza');
  assert.equal(library.find(exercise => exercise.id === 'gym-tobillo-pared').dosage, null);
  const previous = library.find(exercise => exercise.id === 'legacy-plancha-fixture');
  assert.equal(previous.component, 'Core');
  assert.equal(previous.dosage, '4 × 15 s');
  assert.equal(previous.description, 'Descripción previa de prueba');
  const custom = list.find(exercise => exercise.id === 'legacy-custom-fixture');
  assert.equal(custom.isBase, false);
  assert.equal(custom.mediaUrl, 'https://youtu.be/12345678901');
  assert.equal(custom.illustration, null);
  assert.equal((await request('GET', '/exercises', 'ATHLETE')).status, 403);
});

test('Fase 2 D: biblioteca, concurrencia de asignaciones, consulta y retiro con permisos', async () => {
  const body = {
    name: 'Ejercicio de integración', component: 'Movilidad', description: 'Indicaciones de prueba',
    objective: 'Objetivo de prueba', zone: 'Tobillo o pie', level: 'Inicial', equipment: 'Pared',
    instructions: 'Primer paso\nSegundo paso', dosage: '2 × 15 s', mistakes: 'Error de prueba',
    precautions: 'Precaución de prueba', illustration: '/exercises/tobillo-pared.svg',
  };
  assert.equal((await request('POST', '/exercises', 'PHYSIO', {
    ...body, illustration: 'https://example.test/imagen.svg',
  })).status, 400);
  assert.equal((await request('POST', '/exercises', 'PHYSIO', { ...body, component: 'Estabilidad' })).status, 400);
  assert.equal((await request('POST', '/exercises', 'COACH', body)).status, 403);
  assert.equal((await request('POST', '/exercises', 'PHYSIO', { ...body, name: '' })).status, 400);
  const created = await request('POST', '/exercises', 'PHYSIO', body);
  assert.equal(created.status, 201);
  const exerciseId = created.data.id;
  const assignment = { athleteId, exerciseId, dosage: 'Dosificación de prueba', note: 'Indicación individual de prueba' };
  const duplicate = await Promise.all([1, 2].map(() => request('POST', '/exercises/assignments', 'PHYSIO', assignment)));
  assert.deepEqual(duplicate.map(x => x.status).sort(), [201, 409]);
  const id = duplicate.find(x => x.status === 201)!.data.id;
  assert.equal((await request('PATCH', `/exercises/${exerciseId}`, 'PHYSIO', { ...body, name: 'Ejercicio actualizado' })).status, 200);
  const mine = (await request('GET', '/exercises/mine', 'ATHLETE')).data.find((row: any) => row.id === id);
  assert.deepEqual(mine.exercise, {
    ...body, id: exerciseId, name: 'Ejercicio actualizado', isBase: false, mediaUrl: null,
  });
  assert.equal(mine.dosage, assignment.dosage);
  assert.equal(mine.note, assignment.note);
  const athleteAssignments = `/exercises/athlete/${athleteId}`;
  const coaching = `/admin/athletes/${athleteId}/coach`;
  assert.equal((await request('GET', athleteAssignments, 'COACH')).data.find((row: any) => row.id === id).id, id);
  assert.equal((await request('PATCH', coaching, 'ADMIN', { coachId: null })).status, 200);
  try {
    assert.equal((await request('GET', athleteAssignments, 'COACH')).status, 404);
    assert.equal((await request('GET', athleteAssignments, 'PHYSIO')).data.find((row: any) => row.id === id).id, id);
  } finally {
    assert.equal((await request('PATCH', coaching, 'ADMIN', { coachId: users.COACH })).status, 200);
  }
  assert.equal((await request('GET', athleteAssignments, 'COACH')).status, 200);
  assert.equal((await request('DELETE', `/exercises/${exerciseId}`, 'PHYSIO')).data.archived, true);
  assert.equal((await request('DELETE', `/exercises/assignments/${id}`, 'COACH')).status, 403);
  assert.equal((await request('DELETE', `/exercises/assignments/${id}`, 'PHYSIO')).status, 200);
  assert.equal(await prisma.exerciseAssignment.count({ where: { id } }), 0);
  assert.equal((await request('GET', '/exercises/mine', 'ATHLETE')).data.some((row: any) => row.id === id), false);
  const unassigned = await request('POST', '/exercises', 'PHYSIO', { ...body, name: 'Ejercicio sin relaciones' });
  const emptyPath = `/exercises/${unassigned.data.id}`;
  assert.equal((await request('DELETE', emptyPath, 'PHYSIO')).data.archived, false);
  assert.equal(await prisma.exercise.count({ where: { id: unassigned.data.id } }), 0);
});

test('la migración separa la fecha del antecedente y conserva la marca histórica', async () => {
  const unknown = await prisma.injury.findUniqueOrThrow({ where: { id: 'legacy-history-no-date' } });
  const known = await prisma.injury.findUniqueOrThrow({ where: { id: 'legacy-history-with-date' } });
  assert.equal(unknown.historyDate, null);
  assert.equal(unknown.occurredAt.toISOString(), '2026-11-20T00:30:00.000Z');
  assert.equal(known.historyDate?.toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(known.occurredAt.toISOString(), '2026-11-01T00:00:00.000Z');
});

test('la fecha de antecedente es civil, opcional e independiente de la edición de otros campos', async t => {
  // Bogotá todavía es 31 de diciembre, aunque en UTC es 1 de enero.
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2027-01-01T01:30:00Z') });
  const body = { isHistory: true, bodyZone: 'Hombro', injuryType: 'Antecedente sintético', requestId: randomUUID() };
  const created = await request('POST', '/injuries', 'ATHLETE', body);
  assert.equal(created.status, 201);
  assert.equal(created.data.historyDate, null);
  assert.equal((await request('POST', '/injuries', 'ATHLETE', body)).status, 200);
  const path = '/injuries/' + created.data.id + '/history';
  const patch = (extra: Record<string, unknown>) => request('PATCH', path, 'ATHLETE', { bodyZone: 'Hombro', ...extra });
  const edited = await patch({ daysAbsent: 2 });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.historyDate, null);
  assert.equal(edited.data.occurredAt, created.data.occurredAt);

  for (const date of ['2026-01-01', '2026-02-28', '2026-12-30', '2026-12-31']) {
    const result = await patch({ historyDate: date });
    assert.equal(result.status, 200);
    assert.equal(result.data.historyDate, date);
    assert.equal(result.data.occurredAt, created.data.occurredAt);
    assert.equal((await patch({ daysAbsent: 3 })).data.historyDate, date);
  }
  for (const date of ['2027-01-01', '2026-02-29', 'fecha-inválida', '2026-12-31T23:00:00Z']) {
    assert.equal((await patch({ historyDate: date })).status, 400);
  }
  assert.equal((await patch({ daysAbsent: 4 })).data.historyDate, '2026-12-31');
  assert.equal((await patch({ historyDate: null })).data.historyDate, null);
  const dated = await request('POST', '/injuries', 'ATHLETE', {
    ...body, requestId: randomUUID(), historyDate: '2026-12-31',
  });
  assert.equal(dated.status, 201);
  const mine = await request('GET', '/injuries/mine', 'ATHLETE');
  assert.equal(mine.data.find((row: { id: string }) => row.id === dated.data.id).historyDate, '2026-12-31');
  assert.equal(mine.data.find((row: { id: string }) => row.id === created.data.id).historyDate, null);
});


test('el servidor determina la versión aceptada y conserva evidencia del aviso exacto', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2027-01-01T04:59:00Z') });
  const notice = (await request('GET', '/auth/consent', null)).data;
  const data = {
    email: 'consent-' + randomUUID() + '@example.test', fullName: 'Cuenta sintética menor',
    password: 'Ficticia-consent-17', birthDate: '2009-01-01',
  };
  const submit = (consent: unknown) => request('POST', '/auth/register', null, { ...data, consent });
  assert.equal((await submit({ textVersion: 'v0.1-borrador', accepted: true })).status, 409);
  assert.equal((await submit({ textVersion: notice.version, accepted: false })).status, 400);
  assert.equal((await submit({ textVersion: notice.version, accepted: true })).status, 400);
  const created = await submit({ textVersion: notice.version, accepted: true, guardianName: 'Acudiente ficticio' });
  assert.equal(created.status, 201);
  const record = await prisma.consent.findFirstOrThrow({ where: { userId: created.data.id } });
  assert.deepEqual(record.textSnapshot, [notice.version, notice.status, notice.paragraphs]);
  assert.equal(record.textDigest, createHash('sha256').update(JSON.stringify(record.textSnapshot)).digest('hex'));
  assert.equal(record.acceptanceMode, 'SELF_DECLARED_WITH_GUARDIAN');
  assert.equal(record.guardianName, 'Acudiente ficticio');
});

test('las correcciones que involucran la fecha de un menor requieren revisión', async () => {
  const original = await prisma.athlete.findUniqueOrThrow({ where: { id: athleteId } });
  try {
    await prisma.athlete.update({ where: { id: athleteId }, data: { birthDate: new Date('2000-01-01') } });
    assert.equal((await request('PUT', '/athletes/me', 'ATHLETE', { birthDate: '2020-01-01' })).status, 409);
    await prisma.athlete.update({ where: { id: athleteId }, data: { birthDate: new Date('2020-01-01') } });
    assert.equal((await request('PUT', '/athletes/me', 'ATHLETE', { birthDate: '2000-01-01' })).status, 409);
    assert.equal((await request('PUT', '/athletes/me', 'ATHLETE', { birthDate: '2020-01-02' })).status, 409);
    assert.equal((await request('PUT', '/athletes/me', 'ATHLETE', { birthDate: '2020-01-01', weightKg: 42 })).status, 200);
  } finally {
    await prisma.athlete.update({ where: { id: athleteId }, data: { birthDate: original.birthDate, weightKg: original.weightKg } });
  }
});

test('el borrador no habilita registro público en el arranque de producción', async () => {
  const previous = config.isProd;
  config.isProd = true;
  try {
    assert.equal((await request('GET', '/auth/consent', null)).data.available, false);
    assert.equal((await request('POST', '/auth/register', null, {})).status, 503);
  } finally {
    config.isProd = previous;
  }
});
