import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthService, Role } from '../core/auth.service';
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
  let role: Role;
  let params: BehaviorSubject<ParamMap>;

  beforeEach(() => {
    role = 'ATHLETE';
    params = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [SurveysPage], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: AuthService, useValue: { user: () => ({ role }) } },
        { provide: ActivatedRoute, useValue: { paramMap: params } }],
    });
    http = TestBed.inject(HttpTestingController);
  });

  const teamPath = '/api/preventive-surveys/team/sintetico';
  const record = {
    ...context, id: 'registro', kind: 'INITIAL', programName: 'Programa sintético', version: 2,
    catalogueVersion: catalogue.version, catalogue, answers: { injury: 'no' }, submittedAt: '2025-03-01T15:00:00Z',
  };
  const professional = {
    ...overview, eligible: false, athleteName: 'Deportista sintético',
    records: [record], slots: [{ ...slot, writable: false, record }],
  };

  function startProfessional() {
    role = 'PHYSIO';
    params.next(convertToParamMap({ id: 'sintetico' }));
    return TestBed.createComponent(SurveysPage);
  }

  it('permite leer una encuesta presentada en HTTP 200 con eligible false', () => {
    const fixture = startProfessional();
    http.expectOne(teamPath).flush(professional);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Deportista sintético');
    expect(fixture.nativeElement.textContent).toContain('Completada');
    fixture.nativeElement.querySelector('.entry button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dd').textContent.trim()).toBe('No');
    expect(fixture.nativeElement.textContent).toContain('Versión 2');
    expect(fixture.nativeElement.querySelector('form, input, textarea, select')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Ver historial guardado');
    http.expectNone(request => request.url.startsWith(teamPath));
  });

  it('cancela una carga anterior y limpia la lectura al cambiar de deportista', () => {
    const fixture = startProfessional();
    const pending = http.expectOne(teamPath);
    params.next(convertToParamMap({ id: 'segundo' }));
    expect(pending.cancelled).toBeTrue();
    http.expectOne('/api/preventive-surveys/team/segundo').flush(professional);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.entry button').click();
    params.next(convertToParamMap({ id: 'tercero' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-survey-review')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Deportista sintético');
    http.expectOne('/api/preventive-surveys/team/tercero').flush(
      { ...professional, athleteName: 'Tercer deportista', records: [], slots: [] },
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aún no hay encuestas registradas');
    expect(fixture.nativeElement.querySelector('[role=alert]')).toBeNull();
  });

  it('informa la falta de consentimiento profesional aunque revoked sea false', () => {
    const fixture = startProfessional();
    http.expectOne(teamPath).flush({ ...overview, eligible: false, consent: false, revoked: false, context: null, slots: [] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sin autorización vigente');
    expect(fixture.nativeElement.querySelector('.entry')).toBeNull();
  });

  it('permite consultar el historial por intervención aunque no exista una intervención actual', () => {
    const fixture = startProfessional();
    http.expectOne(teamPath).flush({ ...professional, context: null, slots: [] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Historial por intervención');
    fixture.nativeElement.querySelector('.entry button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dd').textContent.trim()).toBe('No');
  });

  for (const [status, message] of [
    [403, 'Acceso restringido'], [404, 'No se encontró el recurso'], [500, 'No pudimos procesar la solicitud'],
  ] as const) {
    it(`distingue HTTP ${status} del estado vacío`, () => {
      const fixture = startProfessional();
      http.expectOne(teamPath).flush({ error: 'detalle interno' }, { status, statusText: 'Error' });
      fixture.detectChanges();
      const alert = fixture.nativeElement.querySelector('[role=alert]');
      expect(alert.textContent).toContain(message);
      expect(alert.textContent).not.toContain('detalle interno');
      const retry = fixture.nativeElement.querySelector('button');
      if (status === 500) {
        retry.click();
        http.expectOne(teamPath).flush(professional);
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('Completada');
      } else {
        expect(retry).toBeNull();
      }
    });
  }

  it('reintenta una consulta fallida por conexión', () => {
    const fixture = startProfessional();
    http.expectOne(teamPath).error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain('conectar');
    fixture.nativeElement.querySelector('button').click();
    http.expectOne(teamPath).flush(professional);
  });

  it('retira el reintento de paginación cuando se abre una encuesta', () => {
    const fixture = startProfessional();
    http.expectOne(teamPath).flush({ ...professional, next: 'siguiente' });
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.archive button').click();
    http.expectOne(teamPath + '?cursor=siguiente').error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Reintentar');
    fixture.nativeElement.querySelector('.entry button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Reintentar');
    expect(fixture.nativeElement.querySelector('dd').textContent.trim()).toBe('No');
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

  it('deja de ofrecer el borrador local si se retira el consentimiento durante un conflicto', () => {
    const { fixture, page } = start();
    page.answers.set({ injury: 'no' });
    page.save(false);
    http.expectOne(path).flush({}, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.conflict button').click();
    http.expectOne(path).flush({ ...overview, consent: false, revoked: true, context: null, slots: [] });
    fixture.detectChanges();
    expect(page.answers()).toEqual({});
    expect(fixture.nativeElement.textContent).toContain('Autorización retirada');
    expect(fixture.nativeElement.textContent).not.toContain('El borrador local queda visible');
  });
});
