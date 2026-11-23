import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WellbeingEntry } from '../core/wellbeing-api';
import { WellbeingPage } from './wellbeing.page';

describe('Mi bienestar', () => {
  const path = '/api/athletes/me/wellbeing';
  const intervention = { programId: 'sintetico', startedOn: '2025-01-01', endsOn: '2025-02-25' };
  const record: WellbeingEntry = {
    id: 'registro', day: '2025-01-08', startedOn: '2025-01-01', week: 2, version: 1,
    program: { id: 'sintetico', name: 'Programa sintético' },
    current: { recordedAt: '2025-01-08T12:00:00Z', version: 1, sleepHours: 7.5,
      rest: null, fatigue: 'NONE', recovery: null, notes: 'Nota privada' },
  };

  beforeEach(() => TestBed.configureTestingModule({
    imports: [WellbeingPage], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function sharingState() {
    TestBed.inject(HttpTestingController).expectOne('/api/athletes/me/sleep/sharing').flush({
      active: false, canRevoke: false, coach: { id: 'entrenador', name: 'Entrenador de prueba' }, status: 'draft',
    });
  }

  it('muestra el vacío, valida respuestas y reintenta la misma operación tras un error de red', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(WellbeingPage);
    fixture.detectChanges();
    sharingState();
    http.expectOne(path).flush({ intervention, entries: [], nextCursor: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Todavía no tienes registros');
    expect(fixture.nativeElement.querySelector('.sharing-status').textContent).toContain('Compartición inactiva');
    expect(fixture.nativeElement.querySelector('.wellbeing-chart')).toBeNull();
    const page = fixture.componentInstance;
    page.start();
    page.save();
    http.expectNone(path);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain('al menos una respuesta');
    page.form.controls.sleepHours.setValue(7.53);
    page.save();
    http.expectNone(path);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#wellbeing-hours').getAttribute('aria-invalid')).toBe('true');

    page.form.controls.sleepHours.setValue(7.5);
    page.form.controls.fatigue.setValue('NONE');
    page.save();
    page.save();
    const first = http.expectOne({ method: 'POST', url: path });
    expect(first.request.body).toEqual({
      operationId: jasmine.any(String), day: '2025-02-25',
      intervention: { programId: 'sintetico', startedOn: '2025-01-01' },
      sleepHours: 7.5, fatigue: 'NONE', rest: null, recovery: null, notes: null,
    });
    first.error(new ProgressEvent('error'));
    expect(page.form.controls.sleepHours.value).toBe(7.5);
    page.save();
    const retry = http.expectOne({ method: 'POST', url: path });
    expect(retry.request.body).toEqual(first.request.body);
    retry.flush({ id: 'registro', version: 1 });
    http.expectOne(path).flush({ intervention, entries: [record], nextCursor: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=status]').textContent).toContain('Registro guardado');
    expect(fixture.nativeElement.querySelectorAll('.wellbeing-chart li').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.wellbeing-latest dd').textContent).toContain('7,5 h');
  });

  it('conserva el borrador al consultar la versión vigente tras un conflicto', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(WellbeingPage);
    fixture.detectChanges();
    sharingState();
    http.expectOne(path).flush({ intervention, entries: [record], nextCursor: null });
    const page = fixture.componentInstance;
    page.start(record);
    page.form.controls.sleepHours.setValue(6.5);
    page.save();
    http.expectOne({ method: 'PATCH', url: path + '/registro' })
      .flush({ code: 'STALE', error: 'Versión anterior' }, { status: 409, statusText: 'Conflict' });
    expect(page.conflictId()).toBe('registro');
    page.save();
    http.expectNone(path + '/registro');
    page.readLatest('registro');
    const latest = { ...record, version: 2, current: { ...record.current, version: 2, sleepHours: 8 } };
    http.expectOne(path + '/registro').flush(latest);
    expect(page.form.controls.sleepHours.value).toBe(6.5);
    expect(page.latest()?.current.sleepHours).toBe(8);
    page.start(latest);
    expect(page.form.controls.sleepHours.value).toBe(8);
    page.save();
    const patch = http.expectOne({ method: 'PATCH', url: path + '/registro' });
    expect(patch.request.body.expectedVersion).toBe(2);
    patch.flush({});
    http.expectOne(path).flush({ intervention, entries: [latest], nextCursor: null });
  });

  it('filtra datos reales por semana, con alternativa textual y sin interpolar omisiones', () => {
    const fixture = TestBed.createComponent(WellbeingPage);
    fixture.detectChanges();
    sharingState();
    TestBed.inject(HttpTestingController).expectOne(path).flush({
      intervention, nextCursor: null, entries: [
        { ...record, id: 'semana3', week: 3, day: '2025-01-15', current: { ...record.current, sleepHours: null, fatigue: 'HIGH' } },
        record, { ...record, id: 'segundo', day: '2025-01-07' },
      ],
    });
    const page = fixture.componentInstance;
    fixture.detectChanges();
    const view: HTMLElement = fixture.nativeElement;
    expect(view.querySelectorAll('.wellbeing-chart li').length).toBe(2);
    expect(view.querySelector('#wellbeing-evolution + *')?.textContent).toBeDefined();
    const evolution = view.querySelector('[aria-labelledby="wellbeing-evolution"]')!;
    expect(evolution.textContent).toContain('Ver tabla de registros');
    expect(evolution.querySelector('table tbody')?.textContent).toContain('Alta');
    const thirdWeek = page.weekOptions().find(([, label]) => label.includes('Semana 3'))!;
    page.week.set(thirdWeek[0]);
    fixture.detectChanges();
    expect(evolution.querySelector('.wellbeing-chart')).toBeNull();
    expect(evolution.textContent).toContain('Aún no hay horas de sueño registradas');
    expect(page.evolution().map(item => item.id)).toEqual(['semana3']);
  });
});
