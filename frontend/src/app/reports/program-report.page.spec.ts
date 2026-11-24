import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ProgramReportPage } from './program-report.page';

const endpoint = '/api/program-reports/me';

describe('ProgramReportPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        provideRouter([{ path: 'informe', component: ProgramReportPage }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('distingue ausencia de intervención y envía el filtro de la URL', async () => {
    const harness = await RouterTestingHarness.create('/informe?programId=real&start=2026-01-01');
    const request = http.expectOne(req => req.url === endpoint);
    expect(request.request.params.get('programId')).toBe('real');
    expect(request.request.params.get('start')).toBe('2026-01-01');
    request.flush({ athlete: { name: 'Fixture' }, interventions: [], report: null });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Sin intervención registrada');
    expect(harness.routeNativeElement?.textContent).not.toContain('Descargar Excel');
  });

  it('reintenta y retira la información previa al volver al informe', async () => {
    const harness = await RouterTestingHarness.create('/informe');
    http.expectOne(endpoint).error(new ProgressEvent('error'));
    harness.detectChanges();
    const host = harness.routeNativeElement!;
    expect(host.textContent).toContain('No pudimos cargar el informe');
    host.querySelector('button')?.click();
    http.expectOne(endpoint).flush({ athlete: { name: 'Dato autorizado' }, interventions: [], report: null });
    harness.detectChanges();
    expect(host.textContent).toContain('Dato autorizado');
    window.dispatchEvent(new Event('focus'));
    harness.detectChanges();
    expect(host.textContent).not.toContain('Dato autorizado');
    http.expectOne(endpoint).flush({}, { status: 404, statusText: 'No disponible' });
    harness.detectChanges();
    expect(host.textContent).toContain('Informe no disponible');
  });
  for (const [status, title, href] of [
    [401, 'Sesión finalizada', '/login'],
    [403, 'Acceso restringido', '/deportista/progreso'],
    [404, 'Informe no disponible', '/deportista/progreso'],
  ] as const) {
    it(`ofrece salida segura y evita reintentar una respuesta ${status}`, async () => {
      const harness = await RouterTestingHarness.create('/informe');
      http.expectOne(endpoint).flush({ error: 'Dato interno de prueba' }, { status, statusText: title });
      harness.detectChanges();
      const host = harness.routeNativeElement!;
      expect(host.textContent).toContain(title);
      expect(host.textContent).not.toContain('Dato interno de prueba');
      expect(host.textContent).not.toContain('Reintentar');
      expect(host.querySelector(`a[href="${href}"]`)).not.toBeNull();
      window.dispatchEvent(new Event('focus'));
      http.expectNone(endpoint);
    });
  }

  it('permite reintentar una falla de servidor', async () => {
    const harness = await RouterTestingHarness.create('/informe');
    http.expectOne(endpoint).flush({}, { status: 503, statusText: 'Servicio no disponible' });
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('button')?.textContent).toContain('Reintentar');
    harness.routeNativeElement?.querySelector('button')?.click();
    http.expectOne(endpoint).flush({ athlete: { name: 'Fixture' }, interventions: [], report: null });
  });

});
