import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../core/auth.service';
import { TeamStore } from '../core/team-store';
import { TeamOverviewPage } from './overview.page';

describe('Día civil del resumen del equipo', () => {
  it('actualiza el encabezado y la agenda al cruzar la medianoche en Bogotá', () => {
    const clock = jasmine.clock();
    clock.install();
    try {
      clock.mockDate(new Date('2027-01-01T04:59:58Z'));
      TestBed.configureTestingModule({
        providers: [
          { provide: AuthService, useValue: { user: () => ({ role: 'PHYSIO' }) } },
          { provide: TeamStore, useValue: { followUps: signal([{ followUpDate: '2026-12-31T00:00:00.000Z' }]) } },
        ],
      });
      const fixture = TestBed.createComponent(TeamOverviewPage);
      try {
        const page = fixture.componentInstance;
        expect(page.calendarToday()).toBe('2026-12-31');
        expect(page.today()).toBe('jueves, 31 de diciembre');
        expect(page.followUpGroups()[0].id).toBe('scheduled');

        clock.tick(2_000);
        expect(page.calendarToday()).toBe('2027-01-01');
        expect(page.today()).toBe('viernes, 1 de enero');
        expect(page.followUpGroups()[0].id).toBe('overdue');
      } finally {
        fixture.destroy();
      }
    } finally {
      clock.uninstall();
    }
  });
});
