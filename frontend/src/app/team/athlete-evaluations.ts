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
import { confirmDialog } from '../core/confirm';
import { blankFms, blankLess, fmsRows, lessRows } from './structured-evaluation';
import { StateView } from '../core/state';
import { apiError } from '../core/auth.service';
import type { EvaluationBaseline, StructuredAssessment } from '../core/team-athlete-api';
import { bogotaDay, formatHistoryDay } from '../core/civil-date';

@Component({
  selector: 'app-athlete-evaluations',
  imports: [DatePipe, StateView, ReactiveFormsModule, RouterLink],
  templateUrl: './athlete-evaluations.html',
  styleUrl: './athlete-evaluations.scss',
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
    SEBT: 'SEBT', YBT: 'YBT-LQ', T_TEST: 'Agility T-test', FMS: 'FMS', LESS: 'LESS', BASELINE: 'Ficha de semana 0',
  };
  readonly currentCoverage = computed(() => {
    const current = this.data()?.intervention;
    if (!current) return null;
    const rows = this.data()?.tests.filter(test => test.program?.id === current.programId &&
      test.interventionStartedAt === current.startedAt) ?? [];
    const baseline = rows.find(test => test.testType === 'BASELINE')?.result as { complete?: boolean } | undefined;
    const instruments = this.instrumentOptions.filter(instrument => instrument !== 'BASELINE');
    const status = (instrument: string, phase: EvaluationPhase) => {
      const tests = rows.filter(test => test.testType === instrument && test.phase === phase);
      if (!tests.length) return 'Sin registro';
      return tests.some(test => (test.result as { complete?: boolean } | null)?.complete !== false)
        ? 'Registrada' : 'Incompleta';
    };
    return {
      baseline: baseline ? baseline.complete ? 'Completa' : 'Incompleta' : 'Sin registro',
      rows: instruments.map(instrument => ({ label: this.title(instrument), initial: status(instrument, 'INITIAL'), final: status(instrument, 'FINAL') })),
    };
  });
  readonly phases = computed(() => [
    { id: 'INITIAL', label: 'Evaluación inicial' },
    { id: 'FINAL', label: 'Evaluación final' },
  ].map(phase => ({
    ...phase,
    tests: (this.data()?.tests.filter(test => test.phase === phase.id) ?? []).sort((a, b) =>
      (b.measuredOn ?? b.measuredAt ?? '').localeCompare(a.measuredOn ?? a.measuredAt ?? '') ||
      a.id.localeCompare(b.id)),
  })));

  readonly fmsRows = fmsRows;
  readonly lessRows = lessRows;
  readonly instrumentOptions = Object.keys(this.instruments);
  fms = blankFms();
  less = blankLess();
  confirming = signal(false);
  isStructured() { return ['FMS', 'LESS', 'BASELINE'].includes(this.form.controls.instrument.value); }
  fmsCompleted() { return this.fms.patterns.filter(row => [...row.scores, ...row.clearing].every(value => value !== null)).length; }
  fmsPain() { return this.fms.patterns.some(row => row.scores.includes(0) || row.clearing.includes(true)); }
  readonly isMissing = (score: number | null) => score === null;

  setScore(scores: (number | null)[], index: number, event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    scores[index] = value === '' ? null : Number(value);
  }

  setClearing(values: (boolean | null)[], index: number, event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    values[index] = value === '' ? null : value === 'yes';
  }

  form = this.fb.group({
    instrument: this.fb.control<EvaluationInstrument>('SEBT'),
    phase: this.fb.control<EvaluationPhase>('INITIAL'),
    measuredOn: this.fb.control('', Validators.required),
    protocol: this.fb.control('', Validators.pattern(/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/)),
    measurements: this.fb.array([this.measurement()]),
    observations: this.fb.control('', Validators.maxLength(1000)),
    baseline: this.fb.group({
      age: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(120)]),
      weight: this.fb.control<number | null>(null, [Validators.min(0.01), Validators.max(500)]),
      experience: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(100)]),
      category: this.fb.control('', Validators.maxLength(60)),
      style: this.fb.control('', Validators.maxLength(60)),
      historyReviewed: this.fb.control(false),
    }),
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.error.set(''));
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
      protocol: (test?.result as { protocol?: string } | null)?.protocol ?? '',
      observations: test?.observations ?? '',
    });
    const recorded = (test?.result as { baseline?: EvaluationBaseline } | null)?.baseline;
    if (recorded) this.form.controls.baseline.patchValue({ ...recorded, category: recorded.category ?? '', style: recorded.style ?? '' });
    const assessment = (test?.result as { assessment?: StructuredAssessment } | null)?.assessment;
    this.fms = assessment?.version === 'FMS-COOK-2014' ? structuredClone(assessment) : blankFms();
    this.less = assessment?.version === 'LESS-17-MEAN3' ? structuredClone(assessment) : blankLess();
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

  async save() {
    const id = this.athleteId();
    if (!id || this.saving() || this.confirming()) return;
    const current = this.editing();
    const intervention = this.data()?.intervention;
    if (!current && !intervention) return;
    const { instrument, phase: selectedPhase, measuredOn, measurements, observations, protocol, baseline: initial } = this.form.getRawValue();
    const timed = instrument === 'T_TEST';
    const baseline: EvaluationBaseline | undefined = instrument === 'BASELINE' ? {
      ...initial, version: 'WEEK0-V1', category: initial.category.trim() || null, style: initial.style.trim() || null,
    } : undefined;
    const phase = baseline ? 'INITIAL' : selectedPhase;
    const assessment = instrument === 'FMS' ? this.fms : instrument === 'LESS' ? this.less : undefined;
    const dateInvalid = this.form.controls.measuredOn.invalid || measuredOn > this.today();
    if (dateInvalid || (!baseline && this.form.controls.protocol.invalid) || this.form.controls.observations.invalid ||
      (baseline && this.form.controls.baseline.invalid) || (!baseline && !assessment && measurements.some(row =>
      row.value === null || !Number.isFinite(row.value) ||
      (timed ? row.value <= 0 : !row.side || !row.direction.trim())
    ))) {
      this.form.markAllAsTouched();
      this.error.set(baseline ? 'Revisa la fecha y los valores de la ficha de semana 0.' :
        assessment ? 'Revisa la fecha, el código de procedimiento y las observaciones.' :
          'Revisa la fecha y todos los intentos. Indica lado y dirección para cada alcance o un tiempo mayor que cero.');
      return;
    }

    const values = measurements.map(row => timed ? { value: row.value! } : {
      value: row.value!,
      side: row.side as 'LEFT' | 'RIGHT',
      direction: row.direction.trim(),
    });
    const existingProtocol = (current?.result as { protocol?: string } | null)?.protocol;
    const fields = { measuredOn, ...(baseline ? { baseline } : assessment ? { assessment } : { measurements: values }), observations: observations.trim() || null,
      ...(!baseline && (protocol || existingProtocol) ? { protocol: protocol || null } : {}) };
    if (instrument === 'LESS') {
      this.confirming.set(true);
      const confirmed = await confirmDialog({
        title: 'Confirmar evaluación LESS',
        text: 'Se guardarán los intentos con los ítems registrados. Puedes continuar o corregirlos posteriormente.',
        confirmText: 'Guardar evaluación',
      }).finally(() => this.confirming.set(false));
      if (!confirmed || this.athleteId() !== id || !this.formOpen() || this.editing() !== current) return;
    }
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
    if (instrument === 'BASELINE') {
      const snapshot = value as { baseline: EvaluationBaseline; complete: boolean };
      const fields = snapshot.baseline;
      return [
        { label: 'Estado', value: snapshot.complete ? 'Completa' : 'Incompleta' },
        { label: 'Edad', value: String(fields.age ?? 'Sin dato') },
        { label: 'Peso (kg)', value: String(fields.weight ?? 'Sin dato') },
        { label: 'Experiencia (años)', value: String(fields.experience ?? 'Sin dato') },
        { label: 'Categoría', value: fields.category ?? 'Sin dato' },
        { label: 'Estilo', value: fields.style ?? 'Sin dato' },
        { label: 'Antecedentes', value: fields.historyReviewed ? 'Revisados' : 'Revisión pendiente' },
      ];
    }
    const scored = value as { assessment?: StructuredAssessment; complete?: boolean; total?: number | null; pain?: boolean;
      patterns?: { score: number | null; asymmetry: boolean }[]; trials?: (number | null)[]; protocol?: string } | null;
    if (scored?.assessment && (instrument === 'FMS' || instrument === 'LESS')) {
      const rows = [
        { label: 'Versión', value: scored.assessment.version },
        { label: 'Procedimiento', value: scored.protocol ?? 'Sin identificar' },
        { label: 'Estado', value: scored.complete ? 'Completa' : 'Incompleta' },
        { label: 'Total', value: scored.total == null ? 'Pendiente' : scored.total.toLocaleString('es-CO', { maximumFractionDigits: 2 }) },
      ];
      if (scored.pain) rows.push({ label: 'Dolor registrado', value: 'Requiere revisión profesional' });
      if (scored.assessment.version === 'FMS-COOK-2014') {
        scored.assessment.patterns.forEach(({ scores, clearing }, i) => {
          const result = scored.patterns?.[i];
          const sides = scores.map((score, side) => fmsRows[i].sides[side] + ': ' + (score ?? 'sin evaluar'));
          const exclusions = clearing.map((flag, index) =>
            fmsRows[i].clearing[index] + ': ' + (flag === null ? 'sin evaluar' : flag ? 'positivo' : 'negativo'));
          rows.push({ label: fmsRows[i].label, value: [...sides, ...exclusions,
            'Resultado: ' + (result?.score ?? 'pendiente'), ...(result?.asymmetry ? ['Asimetría'] : [])].join(' · ') });
        });
      } else {
        scored.assessment.trials.forEach((items, i) => rows.push({
          label: `Intento ${i + 1}`, value: `${scored.trials?.[i] ?? 'Incompleto'} · Ítems: ${items.map(score => score ?? '–').join(', ')}`,
        }));
      }
      return rows;
    }
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
