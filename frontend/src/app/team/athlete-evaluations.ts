import {
  afterNextRender, Component, computed, DestroyRef, effect, ElementRef, inject, Injector,
  input, signal, untracked, viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import {
  EvaluationHistory, EvaluationInstrument, EvaluationMeasurement, EvaluationPhase,
  EvaluationRevision, FunctionalEvaluation, TeamAthleteApi,
} from '../core/team-athlete-api';
import { StateView } from '../core/state';
import { apiError } from '../core/auth.service';
import { bogotaDay, formatHistoryDay } from '../core/civil-date';

@Component({
  selector: 'app-athlete-evaluations',
  imports: [DatePipe, StateView, ReactiveFormsModule, RouterLink],
  templateUrl: './athlete-evaluations.html',
})
export class AthleteEvaluations {
  athleteId = input<string>();
  private api = inject(TeamAthleteApi);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private fb = inject(NonNullableFormBuilder);
  private formTitle = viewChild<ElementRef<HTMLElement>>('formTitle');
  private request?: Subscription;
  private historyRequest?: Subscription;
  private writeRequest?: Subscription;
  private lastOperation?: { payload: string; id: string };

  data = signal<EvaluationHistory | null>(null);
  loading = signal(true);
  failed = signal(false);
  saving = signal(false);
  saved = signal(false);
  error = signal('');
  editing = signal<FunctionalEvaluation | null>(null);
  formOpen = signal(false);
  history = signal<{ id: string; items?: EvaluationRevision[]; failed?: boolean } | null>(null);
  readonly today = bogotaDay;
  readonly formatDay = formatHistoryDay;
  readonly instruments: Record<EvaluationInstrument, string> = {
    SEBT: 'SEBT', YBT: 'YBT-LQ', T_TEST: 'Agility T-test',
  };
  readonly phases = computed(() => [
    { id: 'INITIAL', label: 'Evaluación inicial' },
    { id: 'FINAL', label: 'Evaluación final' },
  ].map(phase => ({
    ...phase,
    tests: (this.data()?.tests.filter(test => test.phase === phase.id) ?? []).sort((a, b) =>
      (b.measuredOn ?? b.measuredAt ?? '').localeCompare(a.measuredOn ?? a.measuredAt ?? '') ||
      a.id.localeCompare(b.id)),
  })));

  form = this.fb.group({
    instrument: this.fb.control<EvaluationInstrument>('SEBT'),
    phase: this.fb.control<EvaluationPhase>('INITIAL'),
    measuredOn: this.fb.control('', Validators.required),
    measurements: this.fb.array([this.measurement()]),
    observations: this.fb.control('', Validators.maxLength(1000)),
  });

  constructor() {
    effect(() => {
      const id = this.athleteId();
      untracked(() => {
        this.writeRequest?.unsubscribe();
        this.historyRequest?.unsubscribe();
        this.saving.set(false);
        this.saved.set(false);
        this.history.set(null);
        this.closeForm();
        this.load(id);
      });
    });
  }

  load(id = this.athleteId()) {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.failed.set(false);
    this.request = (id ? this.api.evaluations(id) : this.api.ownEvaluations())
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: data => { this.data.set(data); this.loading.set(false); },
        error: () => { this.failed.set(true); this.loading.set(false); },
      });
  }

  private measurement(row?: EvaluationMeasurement) {
    return this.fb.group({
      value: this.fb.control<number | null>(row?.value ?? null, [Validators.required, Validators.min(0)]),
      side: this.fb.control<'LEFT' | 'RIGHT' | ''>(row?.side ?? ''),
      direction: this.fb.control(row?.direction ?? '', Validators.maxLength(40)),
    });
  }

  addMeasurement() { this.form.controls.measurements.push(this.measurement()); }

  startForm(test?: FunctionalEvaluation) {
    this.lastOperation = undefined;
    this.saved.set(false);
    this.error.set('');
    this.editing.set(test ?? null);
    this.form.reset({
      instrument: (test?.testType as EvaluationInstrument | undefined) ?? 'SEBT',
      phase: test?.phase ?? 'INITIAL',
      measuredOn: test?.measuredOn ?? this.today(),
      observations: test?.observations ?? '',
    });
    const rows = test ? this.structuredResult(test.result) : [];
    this.form.setControl('measurements', this.fb.array(rows.length ? rows.map(row => this.measurement(row)) : [this.measurement()]));
    this.formOpen.set(true);
    afterNextRender(() => this.formTitle()?.nativeElement.focus(), { injector: this.injector });
  }

  closeForm() {
    this.formOpen.set(false);
    this.editing.set(null);
    this.error.set('');
  }

  save() {
    const id = this.athleteId();
    if (!id || this.saving()) return;
    const current = this.editing();
    const intervention = this.data()?.intervention;
    if (!current && !intervention) return;
    const { instrument, phase, measuredOn, measurements, observations } = this.form.getRawValue();
    const timed = instrument === 'T_TEST';
    if (this.form.invalid || measuredOn > this.today() || measurements.some(row =>
      row.value === null || !Number.isFinite(row.value) ||
      (timed ? row.value <= 0 : !row.side || !row.direction.trim())
    )) {
      this.form.markAllAsTouched();
      this.error.set('Revisa la fecha y todos los intentos. Indica lado y dirección para cada alcance o un tiempo mayor que cero.');
      return;
    }

    const values = measurements.map(row => timed ? { value: row.value! } : {
      value: row.value!,
      side: row.side as 'LEFT' | 'RIGHT',
      direction: row.direction.trim(),
    });
    const fields = { measuredOn, measurements: values, observations: observations.trim() || null };
    const payload = JSON.stringify({ fields, instrument, phase, target: current?.id, version: current?.version, intervention });
    if (this.lastOperation?.payload !== payload) this.lastOperation = { payload, id: crypto.randomUUID() };
    const body = { ...fields, operationId: this.lastOperation.id };
    const request = current?.version
      ? this.api.updateEvaluation(id, current.id, { ...body, expectedVersion: current.version })
      : this.api.createEvaluation(id, { ...body, instrument, phase, intervention: intervention! });

    this.saving.set(true);
    this.error.set('');
    this.writeRequest = request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
        this.historyRequest?.unsubscribe();
        this.history.set(null);
        this.closeForm();
        this.load(id);
      },
      error: error => { this.saving.set(false); this.error.set(apiError(error)); },
    });
  }

  toggleHistory(testId: string) {
    const id = this.athleteId();
    if (!id) return;
    this.historyRequest?.unsubscribe();
    if (this.history()?.id === testId && !this.history()?.failed) { this.history.set(null); return; }
    this.history.set({ id: testId });
    this.historyRequest = this.api.evaluationRevisions(id, testId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: items => this.history.set({ id: testId, items }),
      error: () => this.history.set({ id: testId, failed: true }),
    });
  }

  title(testType: string) {
    return Object.hasOwn(this.instruments, testType) ? this.instruments[testType as EvaluationInstrument] : testType;
  }

  private structuredResult(value: unknown): EvaluationMeasurement[] {
    return (value as { measurements?: EvaluationMeasurement[] } | null)?.measurements ?? [];
  }

  results(value: unknown, instrument?: string, path: string[] = []): {label: string; value: string}[] {
    if (instrument) {
      return this.structuredResult(value).map((row, i) => ({
        label: row.side ? `Apoyo ${row.side === 'LEFT' ? 'izquierdo' : 'derecho'} · ${row.direction}` : `Intento ${i + 1}`,
        value: `${row.value} ${instrument === 'T_TEST' ? 's' : 'cm'}`,
      }));
    }
    if (value !== null && typeof value === 'object') {
      return Object.entries(value).flatMap(([key, entry]) => this.results(entry, undefined, [...path, key]));
    }
    return [{ label: path.join(' · ') || 'Resultado', value: value === null ? 'Sin valor registrado' : String(value) }];
  }
}
