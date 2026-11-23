import { afterNextRender, Component, computed, DestroyRef, effect, ElementRef, inject, Injector, input, signal, untracked, viewChild } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { apiError } from '../core/auth.service';
import { bogotaDay, formatHistoryDay } from '../core/civil-date';
import { SleepSharing } from './sleep-sharing';
import { WellbeingEvolution } from './wellbeing-evolution';
import { StateView } from '../core/state';
import { fatigueLabels, recoveryLabels, restLabels, WellbeingApi, WellbeingEntry, WellbeingIntervention, WellbeingRevision, WellbeingValues } from '../core/wellbeing-api';

@Component({
  selector: 'app-wellbeing',
  imports: [DatePipe, NgTemplateOutlet, ReactiveFormsModule, StateView, SleepSharing, WellbeingEvolution],
  templateUrl: './wellbeing.page.html',
  styleUrl: './wellbeing.page.scss',
})
export class WellbeingPage {
  athleteId = input<string>();
  private api = inject(WellbeingApi);
  private lifecycle = inject(DestroyRef);
  private injector = inject(Injector);
  private fb = inject(NonNullableFormBuilder);
  private title = viewChild<ElementRef<HTMLElement>>('formTitle');
  private formError = viewChild<ElementRef<HTMLElement>>('formError');
  private notice = viewChild<ElementRef<HTMLElement>>('saveNotice');
  private openButton = viewChild<ElementRef<HTMLElement>>('openForm');
  private returnFocus?: HTMLElement;
  private listRequest?: Subscription;
  private historyRequest?: Subscription;
  private saveRequest?: Subscription;
  private recoveryRequest?: Subscription;
  private operation?: { fingerprint: string; id: string };

  entries = signal<WellbeingEntry[]>([]);
  intervention = signal<WellbeingIntervention | null>(null);
  cursor = signal<string | null>(null);
  loading = signal(true);
  listError = signal('');
  open = signal(false);
  editing = signal<WellbeingEntry | null>(null);
  saving = signal(false);
  success = signal(false);
  submitted = signal(false);
  error = signal('');
  conflictId = signal<string | null>(null);
  contextConflict = signal(false);
  latest = signal<WellbeingEntry | null>(null);
  recovering = signal(false);
  recoveryError = signal('');
  historyState = signal<{ id: string; revisions: WellbeingRevision[]; nextBefore: number | null; loading: boolean; error: boolean } | null>(null);
  week = signal('');
  readonly today = bogotaDay;
  readonly formatDay = formatHistoryDay;
  private readonly hoursFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });
  readonly formatHours = (hours: number) => this.hoursFormat.format(hours) + ' h';
  readonly restLabels = restLabels;
  readonly fatigueLabels = fatigueLabels;
  readonly recoveryLabels = recoveryLabels;
  readonly restOptions = Object.entries(restLabels);
  readonly fatigueOptions = Object.entries(fatigueLabels);
  readonly recoveryOptions = Object.entries(recoveryLabels);

  form = this.fb.group({
    day: this.fb.control('', Validators.required),
    sleepHours: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(24)]),
    rest: this.fb.control<NonNullable<WellbeingValues['rest']> | ''>(''),
    fatigue: this.fb.control<NonNullable<WellbeingValues['fatigue']> | ''>(''),
    recovery: this.fb.control<NonNullable<WellbeingValues['recovery']> | ''>(''),
    notes: this.fb.control('', Validators.maxLength(500)),
  });

  readonly weekOptions = computed(() => [...new Map(this.entries().map(entry => [
    this.weekKey(entry), `Semana ${entry.week} · ${entry.program.name} · Inicio ${this.formatDay(entry.startedOn)}`,
  ])).entries()]);
  readonly evolution = computed(() => this.entries().filter(entry => !this.week() || this.weekKey(entry) === this.week()).reverse());
  readonly sleepSeries = computed(() => this.evolution().filter(entry => entry.current.sleepHours !== null));
  latestDay() {
    const context = this.intervention();
    const now = this.today();
    return context && context.endsOn < now ? context.endsOn : now;
  }

  constructor() {
    effect(() => {
      const id = this.athleteId();
      untracked(() => {
        this.historyRequest?.unsubscribe();
        this.saveRequest?.unsubscribe();
        this.recoveryRequest?.unsubscribe();
        this.entries.set([]);
        this.historyState.set(null);
        this.week.set('');
        this.open.set(false);
        this.saving.set(false);
        this.recovering.set(false);
        this.success.set(false);
        this.load(undefined, id);
      });
    });
  }

  private weekKey(entry: WellbeingEntry) {
    return JSON.stringify([entry.program.id, entry.startedOn, entry.week]);
  }

  private focus(ref: () => ElementRef<HTMLElement> | undefined) {
    afterNextRender(() => ref()?.nativeElement.focus(), { injector: this.injector });
  }

  load(cursor?: string, athleteId = this.athleteId()) {
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.listError.set('');
    this.listRequest = this.api.list(athleteId, cursor).pipe(takeUntilDestroyed(this.lifecycle)).subscribe({
      next: result => {
        this.entries.update(entries => cursor ? [...entries, ...result.entries] : result.entries);
        this.cursor.set(result.nextCursor);
        this.intervention.set(result.intervention ?? null);
        if (!this.weekOptions().some(([key]) => key === this.week())) this.week.set('');
        this.contextConflict.set(false);
        this.loading.set(false);
      },
      error: error => { this.listError.set(apiError(error)); this.loading.set(false); },
    });
  }

  start(entry?: WellbeingEntry, trigger?: HTMLElement) {
    if (this.athleteId() || this.saving()) return;
    this.operation = undefined;
    if (!this.open()) this.returnFocus = trigger;
    this.editing.set(entry ?? null);
    this.submitted.set(false);
    this.success.set(false);
    this.error.set('');
    this.conflictId.set(null);
    this.contextConflict.set(false);
    this.latest.set(null);
    this.recoveryError.set('');
    this.form.reset({
      day: entry?.day ?? this.latestDay(),
      sleepHours: entry?.current.sleepHours ?? null,
      rest: entry?.current.rest ?? '',
      fatigue: entry?.current.fatigue ?? '',
      recovery: entry?.current.recovery ?? '',
      notes: entry?.current.notes ?? '',
    });
    this.open.set(true);
    this.focus(this.title);
  }

  cancel() {
    this.recoveryRequest?.unsubscribe();
    this.recovering.set(false);
    this.open.set(false);
    afterNextRender(() => {
      if (this.returnFocus?.isConnected) this.returnFocus.focus();
      else this.openButton()?.nativeElement.focus();
    }, { injector: this.injector });
  }

  invalidDay(day = this.form.controls.day.value) {
    return !this.editing() && (!day || !this.intervention() || day < this.intervention()!.startedOn || day > this.latestDay());
  }

  invalidSleep(hours = this.form.controls.sleepHours.value) {
    return hours !== null && (!Number.isFinite(hours) || hours < 0 || hours > 24 ||
      Math.abs(hours * 10 - Math.round(hours * 10)) > 1e-8);
  }

  save() {
    if (this.saving() || this.athleteId() || this.conflictId() || this.contextConflict()) return;
    const { day, sleepHours, rest, fatigue, recovery, notes } = this.form.getRawValue();
    this.submitted.set(true);
    if (this.invalidDay(day) || this.invalidSleep(sleepHours) || this.form.invalid ||
        (sleepHours === null && !rest && !fatigue && !recovery)) {
      this.error.set('Revisa los campos señalados y registra al menos una respuesta de bienestar.');
      this.focus(this.formError);
      return;
    }
    const entry = this.editing();
    const values = { sleepHours, rest: rest || null, fatigue: fatigue || null, recovery: recovery || null, notes: notes.trim() || null };
    const context = this.intervention();
    const fingerprint = JSON.stringify({ id: entry?.id, version: entry?.version, day, values, context });
    if (this.operation?.fingerprint !== fingerprint) this.operation = { fingerprint, id: crypto.randomUUID() };
    const body = { ...values, operationId: this.operation.id };
    const request = entry
      ? this.api.edit(entry.id, { ...body, expectedVersion: entry.version })
      : this.api.create({ ...body, day, intervention: { programId: context!.programId, startedOn: context!.startedOn } });

    this.saving.set(true);
    this.error.set('');
    this.saveRequest = request.pipe(takeUntilDestroyed(this.lifecycle)).subscribe({
      next: () => {
        this.saving.set(false);
        this.open.set(false);
        this.success.set(true);
        this.historyRequest?.unsubscribe();
        this.historyState.set(null);
        this.load();
        this.focus(this.notice);
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(apiError(error));
        if (error.status === 409) {
          if (error.error?.code === 'CONTEXT') this.contextConflict.set(true);
          else this.conflictId.set(entry?.id ?? error.error?.id ?? null);
        }
        this.focus(this.formError);
      },
    });
  }

  readLatest(id: string) {
    this.recovering.set(true);
    this.recoveryError.set('');
    this.recoveryRequest = this.api.entry(id).pipe(takeUntilDestroyed(this.lifecycle)).subscribe({
      next: entry => { this.latest.set(entry); this.recovering.set(false); },
      error: error => { this.recoveryError.set(apiError(error)); this.recovering.set(false); },
    });
  }

  toggleHistory(id: string) {
    if (this.historyState()?.id === id) {
      this.historyRequest?.unsubscribe();
      this.historyState.set(null);
    } else this.loadHistory(id);
  }

  loadHistory(id: string, before?: number) {
    this.historyRequest?.unsubscribe();
    const prior = this.historyState();
    const revisions = before && prior?.id === id ? prior.revisions : [];
    this.historyState.set({ id, revisions, nextBefore: before ?? null, loading: true, error: false });
    this.historyRequest = this.api.history(id, before).pipe(takeUntilDestroyed(this.lifecycle)).subscribe({
      next: data => this.historyState.set({ id, revisions: [...revisions, ...data.revisions], nextBefore: data.nextBefore, loading: false, error: false }),
      error: () => this.historyState.set({ id, revisions, nextBefore: before ?? null, loading: false, error: true }),
    });
  }
}
