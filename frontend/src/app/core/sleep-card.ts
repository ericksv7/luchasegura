import { Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { apiError } from './auth.service';
import { BarChart } from './charts';
import { formatHistoryDay } from './civil-date';
import { SleepApi, SleepCursor, SleepPeriod } from './sleep-api';
import { StateView } from './state';

@Component({
  selector: 'app-sleep-card',
  imports: [BarChart, StateView],
  host: { '(window:focus)': 'refreshProfessional()' },
  templateUrl: './sleep-card.html',
  styleUrl: './sleep-card.scss',
})
export class SleepCard {
  athleteId = input<string>();
  highlight = input(true);
  private readonly api = inject(SleepApi);
  private readonly destroy = inject(DestroyRef);
  private request?: Subscription;
  private readonly formatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

  readonly formatDay = formatHistoryDay;
  readonly ticks = [0, 6, 12, 18, 24];
  readonly periods = signal<SleepPeriod[]>([]);
  readonly next = signal<SleepCursor | null>(null);
  readonly selected = signal('');
  readonly week = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly forbidden = signal(false);
  readonly period = computed(() => this.periods().find(period => this.key(period) === this.selected()));
  readonly weeks = computed(() => [...new Set(this.period()?.points.map(point => point.week) ?? [])].sort((a, b) => a - b));
  readonly points = computed(() => this.period()?.points.filter(point => point.week === this.week()) ?? []);
  readonly bars = computed(() => this.points().map(point => ({
    label: point.day.slice(8) + '/' + point.day.slice(5, 7), value: point.hours,
    description: `${this.formatDay(point.day)} · ${this.hours(point.hours)} horas`,
  })));

  constructor() {
    effect(() => {
      const athleteId = this.athleteId();
      untracked(() => {
        this.selected.set('');
        this.load(undefined, athleteId);
      });
    });
  }

  key(period: SleepPeriod) { return JSON.stringify([period.programId, period.startedOn]); }
  hours(value: number) { return this.formatter.format(value); }

  select(key: string) {
    this.selected.set(key);
    this.week.set(this.weeks().at(-1) ?? 0);
  }

  refreshProfessional() {
    if (this.athleteId() && !this.loading()) this.load();
  }

  load(cursor?: SleepCursor, athleteId = this.athleteId()) {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.forbidden.set(false);
    if (!cursor) this.periods.set([]);
    this.request = this.api.list(athleteId, cursor).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: data => {
        this.periods.update(periods => cursor ? [...periods, ...data.periods] : data.periods);
        this.next.set(data.next);
        if (!this.period() && this.periods()[0]) this.select(this.key(this.periods()[0]));
        else if (!this.weeks().includes(this.week())) this.week.set(this.weeks().at(-1) ?? 0);
        this.loading.set(false);
      },
      error: error => {
        this.loading.set(false);
        if (error.status === 403 || error.status === 404) {
          this.periods.set([]);
          this.next.set(null);
          this.forbidden.set(true);
        } else this.error.set(apiError(error));
      },
    });
  }
}
