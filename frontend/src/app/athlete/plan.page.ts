import { RouterLink } from '@angular/router';
import { ViewportScroller } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AthleteStore, ProgramExercise, ProgramSession } from '../core/athlete-store';
import { Assignment, ExerciseApi, exerciseCategoryLabel, exerciseGroups } from '../core/exercise-api';
import { ExThumb, ExerciseDialog, ExerciseView } from '../core/exercise-ui';
import { Icon, compClass, iconForComponent } from '../core/icon';
import { StateView } from '../core/state';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-plan',
  imports: [RouterLink, StateView, Icon, ExThumb, ExerciseDialog],
  template: `
    <header class="page-head">
      <h1>Mi plan</h1>
      <p class="sub">Tus ejercicios asignados y las sesiones del programa preventivo.</p>
      <a routerLink="/deportista/encuestas">Encuestas preventivas</a>
    </header>

    <nav class="program-jumps section-sm" aria-label="Secciones de Mi plan">
      <button class="btn secondary sm" type="button" (click)="scroll.scrollToAnchor('p-individual')">Ir a ejercicios individuales</button>
      <button class="btn secondary sm" type="button" (click)="scroll.scrollToAnchor('p-program')">Ir al programa</button>
    </nav>
    <section class="card section-sm" id="p-individual" aria-labelledby="p-asg" tabindex="-1">
      <h2 id="p-asg">Ejercicios individuales</h2>
      <p class="meta">Aquí están las indicaciones que te asignó fisioterapia directamente.</p>
      @if (aLoading()) {
        <div class="stack" aria-busy="true" aria-label="Cargando">
          <div class="sk sk-row"></div><div class="sk sk-row"></div>
        </div>
      } @else if (aFailed()) {
        <app-state kind="error" title="No pudimos cargar tus ejercicios" action="Reintentar" (act)="loadAssignments()" />
      } @else if (groups().length) {
        @for (g of groups(); track g.c) {
          <h3 class="grp">
            <span [class]="'grp-ic ' + cls(g.c)"><app-icon [name]="iconFor(g.c)" /></span>
            {{ categoryLabel(g.c) }} <small>{{ g.items.length }}</small>
          </h3>
          <ul class="asg-list">
            @for (a of g.items; track a.id) {
              <li>
                <button type="button" class="asg-main" (click)="viewAssigned(a)" [attr.aria-label]="'Ver cómo se hace ' + a.exercise.name">
                  <app-ex-thumb [component]="a.exercise.component" [illustration]="a.exercise.illustration" [alt]="'Ilustración de ' + a.exercise.name" />
                  <span class="exc-text">
                    <strong>{{ a.exercise.name }}</strong>
                    <small>{{ a.dosage || (a.exercise.dosage ? 'Orientativa · ' + a.exercise.dosage : 'Sin dosificación') }}</small>
                    @if (a.note) { <small class="asg-note">{{ a.note }}</small> }
                  </span>
                  <app-icon name="info" />
                </button>
              </li>
            }
          </ul>
        }
      } @else {
        <app-state kind="empty" title="Aún no tienes ejercicios asignados"
          text="Cuando tu fisioterapeuta te asigne ejercicios de movilidad o fuerza, aparecerán aquí." />
      }
    </section>

    <section id="p-program" aria-label="Programa preventivo" tabindex="-1">
      @if (store.failed()) {
        <app-state kind="error" title="No pudimos cargar tu plan"
          text="Revisa tu conexión e inténtalo de nuevo." action="Reintentar" (act)="store.load()" />
      } @else if (store.loading()) {
        <div class="stack" aria-busy="true" aria-label="Cargando">
          <div class="sk sk-input"></div><div class="sk sk-card"></div><div class="sk sk-card"></div>
        </div>
      } @else if (store.program(); as p) {
        <h2 class="sec-title">Programa de {{ p.weeks }} {{ p.weeks === 1 ? 'semana' : 'semanas' }}</h2>
        <p class="meta">Elige una semana y marca una sesión cuando la hayas realizado.</p>

        @if (!p.currentWeek) { <p class="notice" role="status">El programa aún no ha comenzado. El equipo de fisioterapia registrará el inicio de la intervención. Se conserva el historial de sesiones completadas.</p> }
        <div class="weeks" role="group" aria-label="Semanas del programa">
          @for (w of weeks(); track w) {
            <button type="button" class="week"
              [class.on]="w === sel()" [class.cur]="w === p.currentWeek" [class.locked]="w > p.currentWeek"
              [attr.aria-pressed]="w === sel()"
              [attr.aria-label]="weekLabel(w, p.currentWeek)"
              (click)="selected.set(w)">
              <span class="wn">{{ w }}</span>
              <span class="wd" aria-hidden="true">
                @for (d of dots(w); track $index) { <i [class.f]="d"></i> }
              </span>
            </button>
          }
        </div>

        @if (sel() > p.currentWeek) {
          <div class="card">
            <app-state kind="empty" title="Esta semana todavía no está disponible"
              text="Se habilita cuando llegues a la semana {{ sel() }} del programa." />
          </div>
        } @else {
          <div class="week-head">
            <p class="meta"><strong>Semana {{ sel() }}</strong> · {{ doneInWeek() }} de {{ weekSessions().length }} {{ weekSessions().length === 1 ? 'sesión' : 'sesiones' }}</p>
            <div class="bar" role="progressbar" aria-label="Progreso de la semana" aria-valuemin="0" aria-valuemax="100"
              [attr.aria-valuenow]="weekPct()"><i [style.width.%]="weekPct()"></i></div>
          </div>

          <div class="stack">
            @for (s of weekSessions(); track s.id) {
              <article class="card session" [class.is-done]="s.done">
                <div class="session-head">
                  <div>
                    <h2>Sesión {{ s.number }}</h2>
                    <p class="meta">{{ s.minutes !== null ? s.minutes + ' min · ' : '' }}{{ s.exercises.length }} ejercicios</p>
                  </div>
                  <button type="button" class="done-btn" [class.on]="s.done" [attr.aria-pressed]="s.done"
                    [attr.aria-label]="(s.done ? 'Desmarcar' : 'Marcar como completada') + ' la sesión ' + s.number"
                    [disabled]="store.savingSessions().has(s.id)" [attr.aria-busy]="store.savingSessions().has(s.id)"
                    (click)="toggle(s)">
                    <app-icon name="check" />
                    <span>{{ store.savingSessions().has(s.id) ? 'Guardando…' : s.done ? 'Completada' : 'Marcar' }}</span>
                  </button>
                </div>
                <ul class="ex-list">
                  @for (e of s.exercises; track e.id ?? $index) {
                    <li>
                      <button type="button" class="ex-btn" (click)="viewProgram(e, s)" [attr.aria-label]="'Ver cómo se hace ' + e.name">
                        <app-ex-thumb [component]="e.component" [illustration]="e.illustration" [alt]="'Ilustración de ' + e.name" />
                        <span class="exc-text">
                          <strong>{{ e.name }}</strong>
                          @if (e.dosage) { <small>Orientativa · {{ e.dosage }}</small> }
                        </span>
                        <app-icon name="info" />
                      </button>
                    </li>
                  }
                </ul>
              </article>
            }
          </div>
        }

      } @else {
        <div class="card">
          <app-state kind="empty" title="Aún no tienes un programa asignado"
            text="Cuando el equipo de fisioterapia cargue el programa, lo verás aquí." />
        </div>
      }
    </section>

    @if (store.program() && !store.loading() && !store.failed()) {
      <section class="card tips section" aria-labelledby="h-tips">
        <h2 id="h-tips">Recuperación y cuidado</h2>
        <ul>
          <li>Prioriza el descanso y el sueño entre entrenamientos.</li>
          <li>Hidrátate antes, durante y después de entrenar.</li>
          <li>Avisa a tu entrenador o fisioterapeuta apenas notes una molestia.</li>
          <li>Si el dolor empeora, no sigas entrenando y busca atención.</li>
        </ul>
      </section>
    }

    <app-exercise-dialog [ex]="selectedEx()" (done)="selectedEx.set(null)" />
  `
})
export class PlanPage {
  scroll = inject(ViewportScroller);
  store = inject(AthleteStore);
  private toast = inject(ToastService);
  private api = inject(ExerciseApi);

  iconFor = iconForComponent;
  categoryLabel = exerciseCategoryLabel;
  cls = compClass;

  selected = signal<number | null>(null);
  sel = computed(() => this.selected() ?? Math.max(1, this.store.currentWeek()));
  weeks = computed(() => Array.from({ length: this.store.program()?.weeks ?? 0 }, (_, i) => i + 1));
  weekSessions = computed(() => this.store.sessions().filter((s) => s.week === this.sel()));
  doneInWeek = computed(() => this.weekSessions().filter((s) => s.done).length);
  weekPct = computed(() => {
    const n = this.weekSessions().length;
    return n ? Math.round((this.doneInWeek() / n) * 100) : 0;
  });

  assignments = signal<Assignment[]>([]);
  aLoading = signal(true);
  aFailed = signal(false);
  selectedEx = signal<ExerciseView | null>(null);
  groups = computed(() =>
    exerciseGroups(this.assignments(), a => a.exercise.component)
  );

  constructor() { this.loadAssignments(); }

  loadAssignments() {
    this.aLoading.set(true);
    this.aFailed.set(false);
    this.api.mine().subscribe({
      next: (a) => { this.assignments.set(a); this.aLoading.set(false); },
      error: () => { this.aFailed.set(true); this.aLoading.set(false); }
    });
  }

  viewAssigned(a: Assignment) {
    this.selectedEx.set({ ...a.exercise, assignedDosage: a.dosage, note: a.note, status: 'Asignación individual' });
  }

  viewProgram(exercise: ProgramExercise, session: ProgramSession) {
    const status = `Semana ${session.week} · Sesión ${session.number} · ${session.done ? 'Completada' : 'Pendiente'}`;
    this.selectedEx.set({ ...exercise, status });
  }

  dots(w: number) {
    const per = this.store.program()?.sessionsPerWeek ?? 3;
    const done = this.store.sessions().filter((s) => s.week === w && s.done).length;
    return Array.from({ length: per }, (_, i) => i < done);
  }

  weekLabel(w: number, current: number) {
    if (w > current) return `Semana ${w}, aún no disponible`;
    const d = this.dots(w);
    const done = d.filter(Boolean).length;
    return `Semana ${w}${w === current ? ', semana actual' : ''}, ${done} de ${d.length} sesiones completadas`;
  }

  toggle(s: ProgramSession) {
    this.store.toggleSession(s.id, done => {
      if (done) this.toast.success('Sesión completada');
    }, msg => this.toast.error(msg));
  }
}