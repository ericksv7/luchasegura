import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, combineLatest, finalize, fromEvent, merge, startWith, switchMap, takeUntil, tap, timer, timeout } from 'rxjs';
import { BarChart, LineChart } from '../core/charts';
import { StateView } from '../core/state';

const detailNumber = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 6 });
const percentNumber = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
const submissionDate = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium' });

interface Intervention { programId: string; start: string; name: string; weeks: number; current: boolean; }
interface Measurement { key: string; value: number; }
interface Evaluation {
  instrument: string; name: string; unit: string;
  records: { id: string; version: number; phase: string; day: string; protocol: string | null; values: Measurement[]; inWindow: boolean }[];
  changes: { key: string; initial: number; final: number; absolute: number; percentage: number | null }[];
}
interface Participation {
  planned: number; plannedToDate: number; completed: number; pending: number; weeksWithRecords: number;
  adherence: number | null; rows: { week: number; planned: number; completed: number }[];
}
interface SurveyPhase { submitted: string | null; reference: { from: string; to: string } | null; }
interface Report {
  intervention: Intervention; plannedEnd: string; through: string | null; status: string;
  participation: Participation | null; denominatorDefinition: string; descriptiveNote: string;
  evaluations: Evaluation[];
  discomfort: {
    zones: { zone: string; count: number }[];
    reports: { id: string; zone: string; day: string; alerts: {
      status: string; events: { kind: string; day: string; status: string }[];
    }[] }[];
  } | null;
  wellbeing: { day: string; sleepHours: number | null; fatigue: string | null; recovery: string | null }[];
  surveys: { initial: SurveyPhase; final: SurveyPhase; comparisons: { question: string; initial: string; final: string }[] } | null;
}
interface Individual { athlete: { name: string }; interventions: Intervention[]; generatedAt: string; report: Report | null; }
interface Group {
  restriction: string; generatedAt: string; report: {
    program: string; through: string; athletes: number; active: number; ended: number; planned: number;
    completed: number; calculable: number; initial: number; final: number; comparable: number;
    discomfort: number; wellbeingCoverage: number; unambiguous: number; adherence: number | null; denominatorDefinition: string;
  } | null;
}

@Component({
  imports: [RouterLink, BarChart, LineChart, StateView],
  templateUrl: './program-report.page.html',
  styleUrl: './program-report.page.scss',
})
export class ProgramReportPage {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly refresh = new Subject<void>();
  private readonly cancelDownload = new Subject<void>();
  protected readonly groupMode = this.route.snapshot.data['group'] === true;
  protected readonly athleteId = signal<string | null>(null);
  protected readonly individual = signal<Individual | null>(null);
  protected readonly group = signal<Group | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly denied = signal(false);
  protected readonly downloading = signal(false);
  protected readonly downloadFailed = signal(false);
  protected readonly report = computed(() => this.individual()?.report);
  protected readonly bars = computed(() => this.report()?.participation?.rows.map(row => ({
    label: 'S' + row.week, value: row.completed, description: `Semana ${row.week}, ${row.completed} de ${row.planned} sesiones`,
  })) ?? []);
  protected readonly chartMax = computed(() => Math.max(1, ...(this.report()?.participation?.rows.map(row => row.planned) ?? [])));
  protected readonly sleep = computed(() => this.report()?.wellbeing.flatMap(row => row.sleepHours === null ? [] : [{
    label: row.day.slice(5), value: row.sleepHours, description: `${row.day}, ${row.sleepHours} horas`,
  }]) ?? []);
  protected readonly labels: Record<string, string> = {
    SCHEDULED: 'Inicio previsto', ACTIVE: 'En curso', PERIOD_ENDED: 'Periodo previsto terminado',
    NEW: 'Nueva', IN_REVIEW: 'En revisión', REVIEWED: 'Revisión registrada', FOLLOW_UP_PENDING: 'Seguimiento pendiente',
    START: 'Inicio de revisión', REVIEW: 'Revisión', REOPEN: 'Reapertura',
    VERY_LOW: 'Muy baja', LOW: 'Baja', MODERATE: 'Moderada', HIGH: 'Alta', VERY_HIGH: 'Muy alta',
    NONE: 'Sin fatiga', MILD: 'Leve', FAIR: 'Intermedia', GOOD: 'Buena', VERY_GOOD: 'Muy buena',
  };
  protected readonly recentSleep = computed(() => this.sleep().slice(-14));
  private url = '';
  private params: Record<string, string> = {};

  constructor() {
    const reload = merge(this.refresh, fromEvent(window, 'focus')).pipe(startWith(null));
    combineLatest([this.route.paramMap, this.route.queryParamMap, reload]).pipe(
      switchMap(([route, query]) => {
        const id = route.get('id');
        const programId = query.get('programId');
        const start = query.get('start');
        this.athleteId.set(id);
        this.url = '/api/program-reports/' + (this.groupMode ? 'group' : id ? 'athletes/' + encodeURIComponent(id) : 'me');
        this.params = programId !== null || start !== null ? { programId: programId ?? '', start: start ?? '' } : {};
        this.cancelDownload.next();
        this.individual.set(null);
        this.group.set(null);
        this.failed.set(false);
        this.denied.set(false);
        this.downloadFailed.set(false);
        this.loading.set(true);
        return timer(30_000, 30_000).pipe(
          startWith(null),
          switchMap(() => this.http.get<Group | Individual>(this.url, { params: this.params }).pipe(
            timeout(12_000),
            tap(data => {
              if ('athlete' in data) this.individual.set(data);
              else this.group.set(data);
              this.failed.set(false);
              this.denied.set(false);
              this.loading.set(false);
            }),
            catchError((error: unknown) => {
              this.cancelDownload.next();
              this.individual.set(null);
              this.group.set(null);
              this.denied.set(error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404));
              this.failed.set(true);
              this.loading.set(false);
              return EMPTY;
            }),
          )),
        );
      }),
      takeUntilDestroyed(this.destroy),
    ).subscribe();
  }

  protected number(value: number) { return detailNumber.format(value); }
  protected percentage(value: number) { return percentNumber.format(value); }
  protected submitted(value: string) { return submissionDate.format(new Date(value)); }

  protected retry() { this.refresh.next(); }

  protected select(index: string) {
    const choice = this.individual()?.interventions[Number(index)];
    if (choice) void this.router.navigate([], { relativeTo: this.route, queryParams: { programId: choice.programId, start: choice.start } });
  }

  protected export() {
    if (this.downloading()) return;
    this.downloading.set(true);
    this.downloadFailed.set(false);
    this.http.get(this.url + '.xlsx', { params: this.params, responseType: 'blob', observe: 'response' }).pipe(
      takeUntil(this.cancelDownload),
      takeUntilDestroyed(this.destroy),
      finalize(() => this.downloading.set(false)),
    ).subscribe({
      next: response => {
        if (!response.body) return;
        const link = document.createElement('a');
        const url = URL.createObjectURL(response.body);
        link.href = url;
        link.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'luchasegura_informe.xlsx';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => { this.retry(); this.downloadFailed.set(true); },
    });
  }
}
