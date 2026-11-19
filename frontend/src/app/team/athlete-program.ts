import { Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService, apiError } from '../core/auth.service';
import { AthleteDetail, TeamAthleteApi } from '../core/team-athlete-api';
import { ToastService } from '../core/toast.service';
import { TeamStore } from '../core/team-store';
import { confirmDialog } from '../core/confirm';
import { ExerciseDialog, ExerciseView } from '../core/exercise-ui';
import { ProgramExercise } from '../core/athlete-store';
import { BarChart } from '../core/charts';

@Component({
  selector: 'app-athlete-program',
  imports: [ReactiveFormsModule, DatePipe, ExerciseDialog, BarChart],
  styles: [`
    :host { display: grid; gap: 14px; min-width: 0; }
    .metrics {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin: 14px 0;
    }
    @media (min-width: 650px) {
      .metrics.has-program { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    @media (min-width: 1280px) {
      .metrics.has-program { grid-template-columns: repeat(6, minmax(0, 1fr)); }
    }
    .metrics > div {
      display: grid;
      align-content: start;
      gap: 4px;
      padding: 12px;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: var(--r);
      background: var(--surf2);
    }
    dt, .metric-note { color: var(--mute); font-size: 13px; }
    .metric-note { display: block; font-weight: 400; }
    dd { margin: 0; font-weight: 700; overflow-wrap: anywhere; }
    .metrics .sk { width: 60%; height: 1rem; }
    .start-form { margin: 0; }
    .start-form .field, .week-picker { max-inline-size: 320px; }
    .week-picker { margin: 14px 0; }
    .sessions-title { font-size: 15px; margin: 0 0 4px; }
    .session-detail > summary small { color: var(--mute); }
    .session-detail > summary strong { margin-inline-end: 8px; }
    .session-exercises .btn { min-height: 44px; text-align: start; }
  `],
  template: `
    <section class="card" aria-labelledby="athlete-program-title">
      <div class="card-head">
        <h2 id="athlete-program-title">Programa preventivo</h2>
        @if (athlete().program; as program) {
          @if (isPhysio) {
            <button type="button" class="disclosure-trigger"
              aria-controls="program-start-form" [attr.aria-expanded]="editing()"
              [disabled]="saving()" (click)="toggleStart()">
              {{ editing() ? 'Cerrar edición' : program.startedAt ? 'Editar fecha' : 'Registrar inicio' }}
            </button>
          }
        }
      </div>
      @if (athlete().program; as program) {
        <p class="meta">{{ program.name || 'Programa preventivo' }} · {{ program.weeks }} {{ program.weeks === 1 ? 'semana' : 'semanas' }} · {{ program.sessionsPerWeek }} {{ program.sessionsPerWeek === 1 ? 'sesión' : 'sesiones' }} por semana</p>
      }
      <dl class="metrics" [class.has-program]="athlete().program">
        <div><dt>Estado del programa</dt><dd>{{ status() }}</dd></div>
        @if (athlete().program; as program) {
          <div><dt>Inicio de intervención</dt><dd>{{ program.startedAt ? (program.startedAt | date:'dd/MM/yyyy':'UTC') : 'Sin registrar' }}</dd></div>
          <div><dt>Semana actual</dt><dd>{{ program.currentWeek ? program.currentWeek + ' de ' + program.weeks : 'Sin semana activa' }}</dd></div>
          <div><dt>Sesiones registradas</dt><dd>{{ completed() }} de {{ program.sessions.length }} completadas</dd></div>
          <div>
            <dt>Adherencia</dt>
            @if (athlete().planned > 0) {
              <dd>{{ athlete().compliance }} %
                <span class="metric-note">{{ athlete().done }} de {{ athlete().planned }} previstas hasta la semana actual</span>
              </dd>
            } @else {
              <dd>Sin sesiones previstas</dd>
            }
          </div>
        }
        <div>
          <dt>Ejercicios asignados</dt>
          @if (assignmentState() === 'loading') {
            <dd aria-busy="true" aria-label="Cargando ejercicios asignados"><div class="sk" aria-hidden="true"></div></dd>
          } @else if (assignmentState() === 'error') {
            <dd>Sin datos</dd>
          } @else {
            <dd>{{ assignmentCount() ? assignmentCount() : 'Ninguno' }}</dd>
          }
        </div>
      </dl>
      @if (athlete().program; as program) {
        @if (!program.startedAt) {
          <p class="notice">{{ isPhysio ? 'Registra el inicio para habilitar las sesiones del deportista.' : 'El inicio está pendiente de registro por fisioterapia.' }}</p>
        }
        @if (isPhysio) {
          <div id="program-start-form" class="disclosure-fold" [class.is-open]="editing()" [attr.inert]="editing() ? null : ''">
          <div class="disclosure-fold-inner">
          <form class="assign start-form"
            [formGroup]="form" (ngSubmit)="save()" novalidate>
            <div class="field">
              <label for="program-start">Fecha real de inicio</label>
              <input id="program-start" type="date" formControlName="startedAt" aria-describedby="program-start-hint"
                [attr.aria-invalid]="form.controls.startedAt.touched && form.invalid ? true : null" />
              <small id="program-start-hint" class="hint">Usa el día en que empezó la intervención.</small>
              @if (form.controls.startedAt.touched && form.invalid) {
                <small class="msg" role="alert">Indica la fecha de inicio de la intervención.</small>
              }
            </div>
            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
            <div class="actions">
              <button class="btn" [disabled]="saving()" [attr.aria-busy]="saving()">{{ saving() ? 'Guardando…' : 'Guardar inicio' }}</button>
            </div>
          </form>
          </div>
          </div>
        }
      }
    </section>

    @if (athlete().program; as program) {
      <section class="card" id="athlete-program-progress" aria-labelledby="program-sessions-title" tabindex="-1">
        <h2 id="program-sessions-title">Sesiones y avance semanal</h2>
        <p class="meta">Compara las sesiones completadas con la meta semanal de {{ program.sessionsPerWeek }}. Elige una semana para consultar sus sesiones.</p>
        <app-bar-chart [bars]="bars()" [max]="program.sessionsPerWeek" [target]="program.sessionsPerWeek"
          ariaLabel="Sesiones completadas por semana del programa" />

        <div class="field week-picker">
          <label for="program-week-select">Semana a consultar</label>
          <select id="program-week-select" #weekSelect [value]="week()" (change)="selectedWeek.set(+weekSelect.value)">
            @for (number of weeks(); track number) {
              <option [value]="number" [selected]="number === week()">Semana {{ number }}{{ number === program.currentWeek ? ' · Actual' : '' }}</option>
            }
          </select>
        </div>
        <h3 class="sessions-title">Sesiones del programa · Semana {{ week() }}</h3>
        @if (weekSessions().length) {
          <p class="meta">{{ weekDone() }} de {{ weekSessions().length }} {{ weekSessions().length === 1 ? 'sesión completada' : 'sesiones completadas' }}. Abre una sesión para consultar sus ejercicios.</p>
          @for (session of weekSessions(); track session.id) {
            <details class="disclosure session-detail" name="athlete-program-sessions">
              <summary>
                <span><strong>Sesión {{ session.number }}</strong>
                <small>{{ session.done ? 'Completada' : week() > program.currentWeek ? 'Aún no disponible' : 'Pendiente' }}{{ session.minutes !== null ? ' · ' + session.minutes + ' min' : '' }}</small></span>
              </summary>
              @if (session.exercises.length) {
                <ul class="list session-exercises">
                  @for (exercise of session.exercises; track $index) {
                    <li><button type="button" class="btn secondary sm" (click)="view(exercise)">
                      {{ exercise.name }}
                    </button></li>
                  }
                </ul>
              } @else {
                <p class="meta">Esta sesión no tiene ejercicios registrados.</p>
              }
            </details>
          }
        } @else {
          <p class="meta">Esta semana no tiene sesiones programadas.</p>
        }
      </section>
    }
    <app-exercise-dialog [ex]="selected()" (done)="selected.set(null)" />`
})

export class AthleteProgram {
  athlete = input.required<AthleteDetail>(); saved = output<void>();
  private destroyRef = inject(DestroyRef);
  private api = inject(TeamAthleteApi); private toast = inject(ToastService); private store = inject(TeamStore);
  isPhysio = inject(AuthService).user()?.role === 'PHYSIO';
  form = inject(NonNullableFormBuilder).group({ startedAt: ['', Validators.required] });
  saving = signal(false); error = signal(''); selected = signal<ExerciseView | null>(null);
  assignmentState = input<'loading' | 'error' | 'ready'>('loading');
  assignmentCount = input(0);
  editing = signal(false);
  selectedWeek = signal<number | null>(null);
  weeks = computed(() => Array.from({ length: this.athlete().program?.weeks ?? 0 }, (_, i) => i + 1));
  week = computed(() => this.selectedWeek() ?? Math.max(1, this.athlete().program?.currentWeek ?? 0));
  weekSessions = computed(() => this.athlete().program?.sessions.filter(s => s.week === this.week()) ?? []);
  weekDone = computed(() => this.weekSessions().filter(s => s.done).length);
  completed = computed(() => this.athlete().program?.sessions.filter(s => s.done).length ?? 0);
  bars = computed(() => this.athlete().weekBars.map(b => ({ label: `S${b.week}`, value: b.done })));
  status = computed(() => {
    const program = this.athlete().program;
    if (!program) return 'Sin programa disponible';
    if (!program.startedAt) return 'Inicio por registrar';
    return program.currentWeek ? 'Iniciado' : 'Inicio programado';
  });
  constructor() {
    effect(() => this.form.reset({ startedAt: this.athlete().program?.startedAt ?? '' }));
  }
  toggleStart() {
    this.editing.update(open => !open);
  }
  view(exercise: ProgramExercise) { this.selected.set({ ...exercise, zone: null }); }
  async save() {
    if (this.saving()) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true); this.error.set('');
    const previous = this.athlete().program?.startedAt ?? null;
    const startedAt = this.form.getRawValue().startedAt;
    if ((previous || this.completed()) && !await confirmDialog({title: '¿Actualizar el inicio de intervención?', text: 'Se recalcularán las semanas y la adherencia. El historial de sesiones se conserva.', confirmText: 'Guardar inicio'})) { this.saving.set(false); return; }
    this.api.setProgramStart(this.athlete().id, startedAt, previous).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.saving.set(false); this.toast.success('Inicio de intervención guardado'); this.store.load(); this.saved.emit(); },
      error: error => { this.saving.set(false); this.error.set(apiError(error)); }
    });
  }
}
