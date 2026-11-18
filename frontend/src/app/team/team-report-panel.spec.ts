import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { TeamReportPanel } from './team-report-panel';

describe('Panel de reportes Excel', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [TeamReportPanel], providers: [provideHttpClient(), provideHttpClientTesting()]
  }));

  function setup() {
    const fixture = TestBed.createComponent(TeamReportPanel);
    fixture.componentRef.setInput('athletes', []);
    fixture.detectChanges();
    return { panel: fixture.componentInstance, http: TestBed.inject(HttpTestingController) };
  }

  it('no envía periodos invertidos y elimina los filtros incompatibles al cambiar de reporte', fakeAsync(() => {
    const { panel, http } = setup();
    panel.from.set('2026-02-01');
    panel.to.set('2026-01-01');
    panel.status.set('NEW');
    panel.download(new Event('submit'));
    http.expectNone(req => req.url === '/api/team/export');

    panel.chooseReport('athletes');
    panel.download(new Event('submit'));
    panel.download(new Event('submit'));
    const request = http.expectOne(req => req.url === '/api/team/export');
    expect(request.request.params.keys()).toEqual(['report', 'privacy']);
    expect(request.request.params.get('report')).toBe('athletes');
    expect(request.request.params.get('privacy')).toBe('coded');
    expect(panel.busy()).toBeTrue();
    request.flush(new Blob(['{"error":"Periodo no disponible."}'], { type: 'application/json' }), {
      status: 422, statusText: 'Unprocessable Content'
    });
    tick();
    flushMicrotasks();
    http.verify();
    expect(panel.busy()).toBeFalse();
    expect(panel.feedback()).toBe('');
  }));

  it('solo activa una descarga después de recibir el archivo esperado', fakeAsync(() => {
    const { panel, http } = setup();
    const click = spyOn(HTMLAnchorElement.prototype, 'click');
    panel.chooseReport('alerts');
    panel.status.set('FOLLOW_UP_PENDING');
    panel.download(new Event('submit'));
    const request = http.expectOne(req => req.url === '/api/team/export');
    expect(request.request.params.get('status')).toBe('FOLLOW_UP_PENDING');
    expect(click).not.toHaveBeenCalled();
    request.flush(new Blob(['archivo'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), {
      headers: { 'Content-Disposition': 'attachment; filename="luchasegura_alertas.xlsx"' }
    });
    expect(click).toHaveBeenCalledTimes(1);
    expect(panel.feedback()).toContain('Excel generado');
    tick(30000);
    http.verify();
  }));
});
