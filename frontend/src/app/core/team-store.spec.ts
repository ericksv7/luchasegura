import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AlertDetail, AlertEntry } from './alert-api';
import { Overview, TeamStore, statusOf } from './team-store';

const detail: AlertDetail = {
  alert: { id: 'alert', status: 'NEW', version: 0, createdAt: '2026-11-17T12:00:00Z', entries: [] },
  athlete: { id: 'athlete', name: 'Prueba' },
  report: { id: 'report', isHistory: false, bodyZone: 'Rodilla', injuryType: null, intensity: 5,
    whenOccurs: null, mechanism: null, limitation: 'NONE', daysAbsent: null, recurrent: false,
    occurredAt: '2026-11-17T12:00:00Z', notes: null, createdAt: '2026-11-17T12:00:00Z' }, history: []
};
const summary = { id: 'alert', status: 'NEW' as const, athleteId: 'athlete', athleteName: 'Prueba', zone: 'Rodilla', intensity: 5, limitation: 'NONE' as const, whenOccurs: null, occurredAt: detail.report.occurredAt, createdAt: detail.alert.createdAt };
const overview: Overview = { stats: { athletes: 1, avgCompliance: 100, newAlerts: 1, followUpAlerts: 0, lowAdherence: 0 },
  alerts: [summary], followUps: [], athletes: [{ id: 'athlete', name: 'Prueba', email: 'test@example.test', week: 1, planned: 1, done: 1, compliance: 100, lowAdherence: false, newAlerts: 1, followUpAlerts: 0, lastReport: null }] };
function receipt(status: AlertEntry['status'], version = 1): AlertEntry {
  return { id: 'entry-' + version, kind: 'REVIEW', version, authorId: 'physio', authorName: 'Profesional', createdAt: detail.alert.createdAt,
    previousStatus: 'NEW', status, observations: 'Observación de prueba', findings: null, actionTaken: 'Actuación de prueba', recommendations: null, referral: null, followUpRequired: status === 'FOLLOW_UP_PENDING', followUpDate: null };
}

describe('Contadores confirmados de alertas', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  function loaded() {
    const store = TestBed.inject(TeamStore); store.load();
    TestBed.inject(HttpTestingController).expectOne('/api/team/overview').flush(overview);
    return store;
  }
  it('retira la alerta revisada y reduce el contador inmediatamente, sin esperar otro GET', () => {
    const store = loaded(); store.recorded(detail, receipt('REVIEWED'));
    expect(store.stats()!.newAlerts).toBe(0); expect(store.alerts()).toEqual([]);
    expect(store.athletes()[0].newAlerts).toBe(0);
    store.recorded(detail, receipt('REVIEWED'));
    expect(store.stats()!.newAlerts).toBe(0);
  });
  it('separa el seguimiento de las pendientes y lo devuelve a revisión al reabrir', () => {
    const store = loaded(); store.recorded(detail, receipt('FOLLOW_UP_PENDING'));
    expect(store.stats()!.newAlerts).toBe(0); expect(store.stats()!.followUpAlerts).toBe(1);
    expect(store.followUps()[0].status).toBe('FOLLOW_UP_PENDING');
    expect(statusOf(store.athletes()[0])).toBe('followUp');
    store.recorded(detail, receipt('REVIEWED', 2));
    expect(store.followUps()).toEqual([]); expect(store.stats()!.followUpAlerts).toBe(0);
    store.recorded(detail, { ...receipt('IN_REVIEW', 3), kind: 'REOPEN' });
    expect(store.stats()!.newAlerts).toBe(1); expect(store.alerts()[0].status).toBe('IN_REVIEW');
    store.recorded(detail, receipt('FOLLOW_UP_PENDING', 1));
    expect(store.stats()!.newAlerts).toBe(1);
  });
  it('cancela consultas viejas y conserva el resultado confirmado si falla la actualización', () => {
    const store = loaded(), http = TestBed.inject(HttpTestingController);
    store.load(); const stale = http.expectOne('/api/team/overview');
    store.recorded(detail, receipt('REVIEWED'));
    expect(stale.cancelled).toBeTrue();
    store.load(); http.expectOne('/api/team/overview').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(store.stats()!.newAlerts).toBe(0); expect(store.alerts()).toEqual([]);
    expect(store.failed()).toBeFalse(); expect(store.refreshFailed()).toBeTrue();
  });
  it('reset cancela la consulta para que una sesión cerrada no recupere información anterior', () => {
    const store = TestBed.inject(TeamStore), http = TestBed.inject(HttpTestingController);
    store.load(); const req = http.expectOne('/api/team/overview'); store.reset();
    expect(req.cancelled).toBeTrue(); expect(store.data()).toBeNull();
  });
});
