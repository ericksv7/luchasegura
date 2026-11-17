import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AlertReviewPage } from './alert-review.page';
import { ToastService } from '../core/toast.service';
import { AlertDetail, AlertEntry } from '../core/alert-api';
import { TeamStore } from '../core/team-store';

const id = '00000000-0000-4000-8000-000000000010';
const initial: AlertDetail = {
  alert: { id, status: 'NEW', version: 0, createdAt: '2026-11-17T12:00:00Z', entries: [] },
  athlete: { id: 'athlete', name: 'Deportista de prueba' },
  report: { id: 'injury', isHistory: false, bodyZone: 'Rodilla', injuryType: null, intensity: 6,
    whenOccurs: null, mechanism: null, limitation: 'NONE', daysAbsent: null, recurrent: false,
    occurredAt: '2026-11-17T12:00:00Z', notes: null, createdAt: '2026-11-17T12:00:00Z' },
  history: []
};

const entry: AlertEntry = { id: 'entry', kind: 'REVIEW', version: 1, authorId: 'physio', authorName: 'Profesional', createdAt: initial.alert.createdAt,
  previousStatus: 'NEW', status: 'REVIEWED', observations: 'Observaciones de prueba', actionTaken: 'Actuación de prueba', findings: null, recommendations: null, referral: null, followUpRequired: false, followUpDate: null };

describe('Revisión de alertas', () => {
  const toast = { success: jasmine.createSpy('success') };
  beforeEach(() => {
    toast.success.calls.reset();
    TestBed.configureTestingModule({
      imports: [AlertReviewPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id })), snapshot: { paramMap: convertToParamMap({ id }) } } },
        { provide: ToastService, useValue: toast }]
    });
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  function open(data: AlertDetail = initial) {
    const fixture = TestBed.createComponent(AlertReviewPage);
    TestBed.inject(HttpTestingController).expectOne(`/api/team/alerts/${id}`).flush(data);
    fixture.detectChanges();
    return fixture;
  }
  function fill(page: AlertReviewPage) {
    page.form.patchValue({ observations: 'Observaciones de prueba', actionTaken: 'Actuación de prueba' });
  }
  it('exige información mínima antes de enviar', () => {
    const page = open().componentInstance;
    page.send('REVIEW');
    TestBed.inject(HttpTestingController).expectNone(`/api/team/alerts/${id}/review`);
    expect(page.form.controls.observations.touched).toBeTrue();
    expect(toast.success).not.toHaveBeenCalled();
  });
  it('un error conserva el formulario y el estado; el reintento reutiliza su clave', () => {
    const page = open().componentInstance; const http = TestBed.inject(HttpTestingController);
    fill(page); page.send('REVIEW');
    const first = http.expectOne(`/api/team/alerts/${id}/review`);
    const key = first.request.body.requestId;
    first.flush({ error: 'No se pudo guardar' }, { status: 503, statusText: 'Unavailable' });
    expect(page.detail()!.alert.status).toBe('NEW');
    expect(page.form.controls.observations.value).toBe('Observaciones de prueba');
    expect(page.saving()).toBeFalse();
    expect(toast.success).not.toHaveBeenCalled();
    page.send('REVIEW');
    const retry = http.expectOne(`/api/team/alerts/${id}/review`);
    expect(retry.request.body.requestId).toBe(key);
    retry.flush({ error: 'Sigue sin conexión' }, { status: 503, statusText: 'Unavailable' });
  });
  it('evita doble clic y actualiza el panel solo tras confirmar el guardado', () => {
    const page = open().componentInstance; const http = TestBed.inject(HttpTestingController);
    fill(page); page.send('REVIEW'); page.send('REVIEW');
    const post = http.expectOne(`/api/team/alerts/${id}/review`);
    expect(toast.success).not.toHaveBeenCalled();
    http.expectNone('/api/team/overview');
    post.flush(entry);
    expect(page.detail()!.alert.status).toBe('REVIEWED');
    expect(page.loading()).toBeFalse();
    expect(page.refreshing()).toBeTrue();
    expect(toast.success).toHaveBeenCalledWith('Revisión guardada');
    http.expectOne('/api/team/overview').flush({ stats: { athletes: 1, avgCompliance: 0, newAlerts: 0, lowAdherence: 0 }, athletes: [], alerts: [] });
    http.expectOne(`/api/team/alerts/${id}`).flush({ ...initial, alert: { ...initial.alert, status: 'REVIEWED', version: 1 } });
    expect(page.detail()!.alert.status).toBe('REVIEWED');
    expect(page.saving()).toBeFalse();
  });
  it('conserva el guardado y los contadores aunque fallen los GET posteriores', () => {
    const page = open().componentInstance, http = TestBed.inject(HttpTestingController), store = TestBed.inject(TeamStore);
    store.data.set({ stats: { athletes: 1, avgCompliance: 0, newAlerts: 1, followUpAlerts: 0, lowAdherence: 0 }, athletes: [], followUps: [], alerts: [{ id, status: 'NEW', athleteId: 'athlete', athleteName: 'Prueba', zone: 'Rodilla', intensity: 6, limitation: 'NONE', whenOccurs: null, occurredAt: initial.report.occurredAt, createdAt: initial.alert.createdAt }] });
    fill(page); page.send('REVIEW'); http.expectOne(`/api/team/alerts/${id}/review`).flush(entry);
    expect(store.stats()!.newAlerts).toBe(0); expect(page.detail()!.alert.entries[0].id).toBe('entry');
    http.expectOne('/api/team/overview').flush({}, { status: 503, statusText: 'Unavailable' });
    http.expectOne(`/api/team/alerts/${id}`).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(store.stats()!.newAlerts).toBe(0); expect(page.detail()!.alert.status).toBe('REVIEWED');
    expect(page.failed()).toBeFalse(); expect(page.loading()).toBeFalse();
    expect(page.savedMessage()).toContain('Revisión guardada');
  });
  it('el skeleton representa encabezado, reporte, formulario e historial y distingue una alerta inexistente', () => {
    const fixture = TestBed.createComponent(AlertReviewPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.review-skeleton[aria-busy="true"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.review-skeleton .card').length).toBe(4);
    expect(fixture.nativeElement.querySelectorAll('.review-skeleton .sk-textarea').length).toBe(5);
    TestBed.inject(HttpTestingController).expectOne(`/api/team/alerts/${id}`).flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(fixture.componentInstance.notFound()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Alerta no disponible');
    expect(fixture.nativeElement.querySelector('.review-skeleton')).toBeNull();
  });

  it('mantiene pendiente el seguimiento por defecto y exige documentar su finalización', () => {
    const follow: AlertDetail = { ...initial, alert: { ...initial.alert, status: 'FOLLOW_UP_PENDING', version: 1,
      entries: [{ ...entry, status: 'FOLLOW_UP_PENDING', followUpRequired: true }] } };
    const fixture = open(follow), page = fixture.componentInstance, http = TestBed.inject(HttpTestingController);
    expect(page.form.controls.followUpRequired.value).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Registrar seguimiento y mantenerlo pendiente');
    page.form.controls.followUpRequired.setValue(false); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[type="submit"], form button:not([type])').textContent).toContain('Finalizar seguimiento');
    page.send('REVIEW'); http.expectNone(`/api/team/alerts/${id}/review`);
    fill(page); page.send('REVIEW');
    const post = http.expectOne(`/api/team/alerts/${id}/review`);
    expect(post.request.body.followUpRequired).toBeFalse();
    expect(post.request.body.observations).toBe('Observaciones de prueba');
    post.flush({ ...entry, id: 'final', version: 2, previousStatus: 'FOLLOW_UP_PENDING' });
    expect(toast.success).toHaveBeenCalledWith('Seguimiento finalizado');
    http.expectOne('/api/team/overview').flush({ stats: { athletes: 1, avgCompliance: 0, newAlerts: 0, followUpAlerts: 0, lowAdherence: 0 }, athletes: [], alerts: [], followUps: [] });
    http.expectOne(`/api/team/alerts/${id}`).flush({ ...follow, alert: { ...follow.alert, status: 'REVIEWED', version: 2, entries: [...follow.alert.entries, { ...entry, id: 'final', version: 2, previousStatus: 'FOLLOW_UP_PENDING' }] } });
    fixture.detectChanges();
    const details: HTMLDetailsElement = fixture.nativeElement.querySelector('details');
    expect(details.open).toBeFalse(); expect(details.textContent).toContain('Reabrir alerta');
    expect(page.detail()!.alert.entries.length).toBe(2);
  });
  it('un fallo al finalizar conserva el seguimiento y sus observaciones sin mostrar éxito', () => {
    const page = open({ ...initial, alert: { ...initial.alert, status: 'FOLLOW_UP_PENDING', version: 1 } }).componentInstance;
    fill(page); page.form.controls.followUpRequired.setValue(false); page.send('REVIEW');
    TestBed.inject(HttpTestingController).expectOne(`/api/team/alerts/${id}/review`).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(page.detail()!.alert.status).toBe('FOLLOW_UP_PENDING');
    expect(page.form.controls.observations.value).toBe('Observaciones de prueba');
    expect(toast.success).not.toHaveBeenCalled();
  });

});
