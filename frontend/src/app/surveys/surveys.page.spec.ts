import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { SurveysPage } from './surveys.page';

describe('Encuestas preventivas', () => {
  const path = '/api/preventive-surveys/me';
  const catalogue = {
    version: 'fixture-v1', reference: { from: '2025-01-01', to: '2025-02-25' },
    questions: [
      { id: 'injury', label: '¿Tuviste una lesión?', group: 'Lesiones', type: 'choice' as const, required: true,
        options: [['yes', 'Sí'], ['no', 'No']] as [string, string][] },
      { id: 'episodes', label: 'Episodios', group: 'Lesiones', type: 'count' as const, when: 'injury' },
      { id: 'warmup', label: 'Calentamiento', group: 'Prácticas', type: 'choice' as const },
    ],
  };
  const context = { programId: 'prueba', startedOn: '2025-03-05' };
  const slot = { ...context, kind: 'INITIAL' as const, writable: true, catalogue, opensOn: '2025-02-26', sportContext: null, record: null };
  const overview = { enabled: true, eligible: true, consent: true, revoked: false, today: '2025-03-01',
    notice: null, context, slots: [slot], records: [], next: null };
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SurveysPage], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: AuthService, useValue: { user: () => ({ role: 'ATHLETE' }) } }],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function start() {
    const fixture = TestBed.createComponent(SurveysPage);
    http.expectOne(path).flush(overview);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.open(slot);
    fixture.detectChanges();
    return { fixture, page };
  }

  it('limpia preguntas dependientes y reintenta un fallo de red con la misma operación', () => {
    const { fixture, page } = start();
    const select = fixture.nativeElement.querySelector('#survey-injury');
    select.value = 'yes';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const count = fixture.nativeElement.querySelector('#survey-episodes');
    count.value = '2';
    count.dispatchEvent(new Event('input'));
    page.go(1); page.go(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#survey-episodes').value).toBe('2');
    const changed = fixture.nativeElement.querySelector('#survey-injury');
    changed.value = 'no';
    changed.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#survey-episodes')).toBeNull();
    page.save(false);
    const first = http.expectOne({ method: 'PUT', url: path });
    expect(first.request.body.answers).toEqual({ injury: 'no' });
    first.error(new ProgressEvent('error'));
    expect(page.answers()).toEqual({ injury: 'no' });
    page.save(false);
    const retry = http.expectOne({ method: 'PUT', url: path });
    expect(retry.request.body).toEqual(first.request.body);
    retry.flush({ id: 'id', version: 1, answers: { injury: 'no' } });
    http.expectOne(path).flush(overview);
    expect(page.notice()).toBe('Borrador guardado.');
  });

  it('exige confirmación, publica errores y mantiene los datos locales ante un conflicto', () => {
    const { page } = start();
    page.go(2);
    page.save(true);
    http.expectNone(path);
    page.confirmed.set(true);
    page.save(true);
    http.expectOne(path).flush({ error: 'Revisa las respuestas señaladas.', invalid: ['injury'] }, { status: 422, statusText: 'Validation' });
    expect(page.invalid()).toEqual(['injury']);
    page.answers.set({ injury: 'no' });
    page.save(true);
    http.expectOne(path).flush({ error: 'Versión vigente distinta' }, { status: 409, statusText: 'Conflict' });
    expect(page.conflict()).toBeTrue();
    expect(page.answers()).toEqual({ injury: 'no' });
    page.save(false);
    http.expectNone(path);
  });
});
