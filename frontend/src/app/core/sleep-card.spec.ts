import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SleepCard } from './sleep-card';
import { SleepPeriod } from './sleep-api';

describe('Evolución del sueño', () => {
  const own = '/api/athletes/me/sleep';
  const period: SleepPeriod = {
    programId: 'p1', name: 'Primera intervención', startedOn: '2025-01-06',
    points: [{ day: '2025-01-06', week: 1, hours: 0 }, { day: '2025-01-08', week: 1, hours: 7.5 },
      { day: '2025-01-14', week: 2, hours: 8 }],
  };

  beforeEach(() => TestBed.configureTestingModule({
    imports: [SleepCard], providers: [provideHttpClient(), provideHttpClientTesting()],
  }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('selecciona semanas con datos y conserva horas y fechas exactas en la tabla', () => {
    const fixture = TestBed.createComponent(SleepCard);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne(own).flush({ periods: [period], next: null });
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(fixture.componentInstance.week()).toBe(2);
    expect(host.querySelectorAll('tbody tr').length).toBe(1);
    const week = host.querySelector<HTMLSelectElement>('#sleep-week')!;
    expect(week.value).toBe('2');
    week.value = '1';
    week.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect([...host.querySelectorAll('tbody time')].map(item => item.getAttribute('datetime')))
      .toEqual(['2025-01-06', '2025-01-08']);
    expect([...host.querySelectorAll('tbody td')].map(item => item.textContent?.trim())).toEqual(['0 h', '7,5 h']);
    expect(host.querySelectorAll('.c-bar').length).toBe(1);
    expect(host.querySelectorAll('.c-track').length).toBe(2);
  });

  it('no conserva mediciones al volver al panel profesional si se revocó el acceso', () => {
    const fixture = TestBed.createComponent(SleepCard);
    fixture.componentRef.setInput('athleteId', 'atleta');
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    const path = '/api/team/athletes/atleta/sleep';
    http.expectOne(path).flush({ periods: [period], next: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('table')).not.toBeNull();
    fixture.componentInstance.refreshProfessional();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
    http.expectOne(path).flush({}, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('no están disponibles');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });

  it('muestra un estado vacío cuando no hay mediciones', () => {
    const fixture = TestBed.createComponent(SleepCard);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne(own).flush({ periods: [], next: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aún no hay horas de sueño registradas');
    expect(fixture.nativeElement.querySelector('svg')).toBeNull();
  });
});
