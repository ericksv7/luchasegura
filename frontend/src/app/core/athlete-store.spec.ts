import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AthleteStore } from './athlete-store';

describe('Confirmación de sesiones del deportista', () => {
  it('bloquea el doble envío y solo actualiza tras una respuesta confirmada', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const store = TestBed.inject(AthleteStore);
    const http = TestBed.inject(HttpTestingController);
    store.load();
    http.expectOne('/api/athletes/me').flush(null);
    http.expectOne('/api/injuries/mine').flush([]);
    http.expectOne('/api/program/current').flush({
      id: 'program', name: 'Prueba', weeks: 1, sessionsPerWeek: 1, currentWeek: 1, startedAt: null,
      sessions: [{ id: 'session', week: 1, number: 1, done: false, minutes: null, exercises: [] }]
    });

    const saved = jasmine.createSpy('saved');
    const failed = jasmine.createSpy('failed');
    const url = '/api/program/sessions/session/toggle';
    store.toggleSession('session', saved, failed);
    store.toggleSession('session', saved, failed);
    const pending = http.expectOne(url);
    expect(pending.request.body).toEqual({ done: true });
    expect(store.sessions()[0].done).toBeFalse();
    expect(saved).not.toHaveBeenCalled();
    pending.flush({ error: 'No disponible' }, { status: 503, statusText: 'Unavailable' });
    expect(failed).toHaveBeenCalledOnceWith('No disponible');
    expect(store.sessions()[0].done).toBeFalse();

    store.toggleSession('session', saved, failed);
    http.expectOne(url).flush({ done: true });
    expect(store.sessions()[0].done).toBeTrue();
    expect(saved).toHaveBeenCalledOnceWith(true);
    http.verify();
  });
});
