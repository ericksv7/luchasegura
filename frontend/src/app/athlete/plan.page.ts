import { Component, computed, inject, signal } from '@angular/core';
import { AthleteStore, ProgramSession } from '../core/athlete-store';
import { StateView } from '../core/state';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-plan',
  imports: [StateView],
  template: `
    <header class="page-head">
      <h1>Mi plan</h1>
      <p class="sub">Tres sesiones por semana durante ocho semanas.</p>
    </header>

    @if (store.failed()) {
      <app-state kind="error" title="No pudimos cargar tu plan"
        text="Revisa tu conexión e inténtalo de nuevo." action="Reintentar" (act)="store.load()" />
    } @else if (store.loading()) {
      <div class="stack" aria-busy="true" aria-label="Cargando">
        <div class="sk sk-input"></div><div class="sk sk-card"></div><div class="sk sk-card"></div>
      </div>
    } @else if (store.program(); as p) {
      <p class="notice" role="note">Programa de ejemplo en revisión por el equipo de fisioterapia.</p>

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
          <p class="meta"><strong>Semana {{ sel() }}</strong> · {{ doneInWeek() }} de {{ weekSessions().length }} sesiones</p>
          <div class="bar" role="progressbar" aria-label="Progreso de la semana" aria-valuemin="0" aria-valuemax="100"
            [attr.aria-valuenow]="weekPct()"><i [style.width.%]="weekPct()"></i></div>
        </div>

        <div class="stack">
          @for (s of weekSessions(); track s.id) {
            <article class="card session" [class.is-done]="s.done">
              <div class="session-head">
                <div>
                  <h2>Sesión {{ s.number }}</h2>
                  <p class="meta">{{ s.minutes }} min · {{ s.exercises.length }} ejercicios</p>
                </div>
                <button type="button" class="done-btn" [class.on]="s.done" [attr.aria-pressed]="s.done"
                  [attr.aria-label]="(s.done ? 'Desmarcar' : 'Marcar como completada') + ' la sesión ' + s.number"
                  (click)="toggle(s)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
                  <span>{{ s.done ? 'Completada' : 'Marcar' }}</span>
                </button>
              </div>
              <ul class="ex-list">
                @for (e of s.exercises; track e.name) {
                  <li>
                    <span class="tag">{{ e.component }}</span>
                    <div><strong>{{ e.name }}</strong><small>{{ e.dosage }}</small></div>
                  </li>
                }
              </ul>
            </article>
          }
        </div>
      }

      <section class="card tips" aria-labelledby="h-tips">
        <h2 id="h-tips">Recuperación y cuidado</h2>
        <ul>
          <li>Prioriza el descanso y el sueño entre entrenamientos.</li>
          <li>Hidrátate antes, durante y después de entrenar.</li>
          <li>Avisa a tu entrenador o fisioterapeuta apenas notes una molestia.</li>
          <li>Si el dolor empeora, no sigas entrenando y busca atención.</li>
        </ul>
      </section>
    } @else {
      <div class="card">
        <app-state kind="empty" title="Aún no tienes un programa asignado"
          text="Cuando el equipo de fisioterapia cargue el programa, lo verás aquí." />
      </div>
    }
  `
})
export class PlanPage {
  store = inject(AthleteStore);
  private toast = inject(ToastService);

  selected = signal<number | null>(null);
  sel = computed(() => this.selected() ?? this.store.currentWeek());
  weeks = computed(() => Array.from({ length: this.store.program()?.weeks ?? 0 }, (_, i) => i + 1));
  weekSessions = computed(() => this.store.sessions().filter((s) => s.week === this.sel()));
  doneInWeek = computed(() => this.weekSessions().filter((s) => s.done).length);
  weekPct = computed(() => {
    const n = this.weekSessions().length;
    return n ? Math.round((this.doneInWeek() / n) * 100) : 0;
  });

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
    const marking = !s.done;
    this.store.toggleSession(s.id, (msg) => this.toast.error(msg));
    if (marking) this.toast.success('Sesión completada');
  }
}