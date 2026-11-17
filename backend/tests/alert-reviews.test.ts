import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { prisma } from '../src/db';
import { config } from '../src/config';
import { Role } from '@prisma/client';
import type { Server } from 'node:http';

if (process.env.ALERT_REVIEW_TESTS !== '1' || !process.env.DATABASE_URL?.includes('/luchasegura_alert_test')) {
  throw new Error('Ejecuta estas pruebas con tests/run-alert-reviews.cjs en la base temporal');
}
let server: Server, base: string;
const users = {} as Record<Role, string>;
let athleteId: string;
before(async () => {
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
