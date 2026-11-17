import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ReportPage } from '../athlete/report.page';
import { TeamRulesPage } from '../team/rules.page';
import { AuthService } from './auth.service';

describe('Envío de formularios sin recarga', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ReportPage, TeamRulesPage],
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthService, useValue: { user: () => ({ role: 'PHYSIO' }) } }
      ]
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('muestra la validación del reporte y evita el envío nativo', () => {
    const fixture = TestBed.createComponent(ReportPage);
    fixture.detectChanges();
    const event = new Event('submit', { bubbles: true, cancelable: true });
    fixture.nativeElement.querySelector('form').dispatchEvent(event);
    fixture.detectChanges();
    expect(fixture.componentInstance.submitted()).toBeTrue();
    expect(event.defaultPrevented).toBeTrue();
    TestBed.inject(HttpTestingController).expectNone('/api/injuries');
  });

  it('conecta el envío de umbrales con save y evita la recarga', () => {
    const fixture = TestBed.createComponent(TeamRulesPage);
    TestBed.inject(HttpTestingController).expectOne('/api/rules').flush([]);
    fixture.detectChanges();
    const save = spyOn(fixture.componentInstance, 'save');
    const event = new Event('submit', { bubbles: true, cancelable: true });
    fixture.nativeElement.querySelector('form').dispatchEvent(event);
    expect(save).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBeTrue();
  });
});
