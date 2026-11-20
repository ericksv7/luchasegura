import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AthleteEvaluations } from './athlete-evaluations';

describe('Evaluaciones funcionales', () => {
  const team = '/api/team/athletes/sintetico/evaluations';
  const intervention = { programId: 'programa', startedAt: '2025-03-01' };

  beforeEach(() => TestBed.configureTestingModule({
    imports: [AthleteEvaluations],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('mantiene compacta la tarjeta final al abrir y cerrar repetidamente la evaluación inicial', () => {
    const fixture = TestBed.createComponent(AthleteEvaluations);
    fixture.componentRef.setInput('athleteId', 'sintetico');
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne(team).flush({
      intervention,
      tests: [{
        id: 'inicial', testType: 'SEBT', phase: 'INITIAL', measuredOn: '2025-03-01',
        result: { measurements: [{ value: 56, side: 'LEFT', direction: 'Anterior' }] },
        program: null, interventionStartedAt: null, observations: 'Observación sintética', version: 1,
      }],
    });
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const grid = host.querySelector<HTMLElement>('.evaluation-cards')!;
    grid.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
    grid.style.setProperty('--disclosure-duration', '0s');
    const initial = host.querySelector<HTMLElement>('[aria-labelledby="phase-INITIAL"]')!;
    const final = host.querySelector<HTMLElement>('[aria-labelledby="phase-FINAL"]')!;
    initial.style.animation = final.style.animation = 'none';
    const summary = initial.querySelector('summary')!;
    const height = (card: Element) => card.getBoundingClientRect().height;
    const initialHeight = height(initial);
    const finalHeight = height(final);
    expect(initial.getBoundingClientRect().top).toBe(final.getBoundingClientRect().top);
    expect(finalHeight).toBeGreaterThan(0);

    for (let i = 0; i < 2; i++) {
      summary.click();
      expect(initial.querySelector('details')?.open).toBeTrue();
      expect(height(initial)).toBeGreaterThan(initialHeight);
      expect(height(final)).toBeCloseTo(finalHeight, 1);
      summary.click();
      expect(initial.querySelector('details')?.open).toBeFalse();
      expect(height(initial)).toBeCloseTo(initialHeight, 1);
      expect(height(final)).toBeCloseTo(finalHeight, 1);
    }
  });

  it('valida el formulario y conserva la clave de un reintento con la misma carga', () => {
    const fixture = TestBed.createComponent(AthleteEvaluations);
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('athleteId', 'sintetico');
    fixture.detectChanges();
    http.expectOne(team).flush({ tests: [], intervention });
    component.startForm();
    component.save();
    http.expectNone(team);
    expect(component.error()).toContain('Revisa la fecha');

    component.form.controls.instrument.setValue('T_TEST');
    component.form.controls.phase.setValue('FINAL');
    component.form.controls.measuredOn.setValue('2025-03-01');
    component.form.controls.measurements.at(0).controls.value.setValue(10.25);
    component.form.controls.observations.setValue('Nota de prueba');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Tiempo (s)');
    expect(fixture.nativeElement.textContent).not.toContain('Lado de apoyo');
    component.save();
    component.save();
    const first = http.expectOne({ method: 'POST', url: team });
    expect(first.request.body).toEqual({
      operationId: jasmine.any(String), instrument: 'T_TEST', phase: 'FINAL',
      measuredOn: '2025-03-01', measurements: [{ value: 10.25 }], observations: 'Nota de prueba',
      intervention,
    });
    first.error(new ProgressEvent('error'));
    component.save();
    const second = http.expectOne({ method: 'POST', url: team });
    expect(second.request.body).toEqual(first.request.body);
    second.flush({ id: 'evaluacion', version: 1 });
    http.expectOne(team).flush({ tests: [], intervention });
    expect(component.saved()).toBeTrue();
    expect(component.formOpen()).toBeFalse();
  });

  it('muestra las fases autorizadas del deportista y sus fechas civiles sin controles de edición', () => {
    const fixture = TestBed.createComponent(AthleteEvaluations);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('/api/athletes/me/evaluations').flush({
      tests: [{
        id: 'a', testType: 'SEBT', phase: 'INITIAL', measuredOn: '2025-03-01',
        result: { measurements: [{ value: 56, side: 'LEFT', direction: 'Anterior' }] },
        program: null, interventionStartedAt: null,
      }, {
        id: 'b', testType: 'T_TEST', phase: 'FINAL', measuredOn: '2025-03-15',
        result: { measurements: [{ value: 10.25 }] }, program: null, interventionStartedAt: null,
      }],
    });
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('[aria-labelledby="phase-INITIAL"]')?.textContent).toContain('56 cm');
    expect(host.querySelector('[aria-labelledby="phase-FINAL"]')?.textContent).toContain('10.25 s');
    const date = host.querySelector('[aria-labelledby="phase-INITIAL"] summary time');
    expect(date?.getAttribute('datetime')).toBe('2025-03-01');
    expect(date?.textContent?.trim()).toBe('1 de mar de 2025');
    expect(host.textContent).not.toContain('Registrar evaluación');
    expect(host.textContent).not.toContain('Observaciones privadas');
  });
});
