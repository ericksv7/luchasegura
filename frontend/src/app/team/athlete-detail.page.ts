import { SleepCard } from '../core/sleep-card';
import { WellbeingPage } from '../athlete/wellbeing.page';
import { formatHistoryDay } from '../core/civil-date';
import { ViewportScroller } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { SectionNav } from '../core/section-nav';
import { AthleteExercises } from './athlete-exercises';
import { AthleteReviews } from './athlete-reviews';
import { AthleteEvaluations } from './athlete-evaluations';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { Injury, LIMIT_LABEL, PAIN_LABEL, fmtDate, painLevel } from '../core/athlete-store';
import { ChartPoint, LineChart, ProgressRing } from '../core/charts';
import { Icon } from '../core/icon';
import { StateView } from '../core/state';

import { AthleteDetail as Detail, TeamAthleteApi } from '../core/team-athlete-api';
import { InjuryCharacterization } from './injury-characterization';
import { AthleteProgram } from './athlete-program';

@Component({
  selector: 'app-athlete-detail',
  imports: [RouterLink, ProgressRing, LineChart, StateView, Icon, SectionNav, AthleteExercises, AthleteReviews, AthleteEvaluations, AthleteProgram, WellbeingPage, SleepCard, InjuryCharacterization],
  template: `
    <a class="back" routerLink="/equipo/deportistas"><app-icon name="arrow-left" /> Deportistas</a>

    @if (failed()) {
      <app-state kind="error" [title]="notFound() ? 'No encontramos a este deportista' : 'No pudimos cargar la ficha'"
        [text]="notFound() ? 'Puede que no esté asignado a tu cuenta.' : 'Revisa tu conexión e inténtalo de nuevo.'"
        [action]="notFound() ? 'Volver a la lista' : 'Reintentar'" (act)="notFound() ? back() : load()" />
    } @else if (loading()) {
      <div class="cards" aria-busy="true" aria-label="Cargando">
        <div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-card"></div>
        <div class="sk sk-chart span-2"></div>
      </div>
    } @else if (d(); as d) {
      <header class="page-head">
        <p class="eyebrow">Ficha del deportista</p>
        <h1>{{ d.name }}</h1>
        <p class="sub">{{ subtitle() }}</p>
      </header>

      <app-section-nav [items]="sections" [active]="tab()" />
      <div class="cards" [hidden]="tab() !== 'summary'">
        <section class="card span-2 athlete-summary" aria-labelledby="d-c">
          <div class="summary-progress">
          <h2 id="d-c">Cumplimiento del programa</h2>
          @if (d.program && d.planned > 0) {
            <div class="ring-row">
              <app-progress-ring [value]="d.compliance"
                [ariaLabel]="'Cumplimiento del programa: ' + d.compliance + ' por ciento'" />
              <p class="ring-meta"><strong>{{ d.done }} de {{ d.planned }}</strong> sesiones hasta hoy</p>
            </div>
          } @else {
            <p class="meta">{{ d.program ? 'La adherencia se calculará desde el inicio registrado de la intervención.' : 'No hay un programa asignado.' }}</p>
          }
          </div>
          <div class="summary-activity">
          <h2 id="d-r">Actividad y pendientes</h2>
          <dl class="stats">
            <div><dt>Semana actual</dt><dd>{{ d.program?.currentWeek || 'Sin iniciar' }}</dd></div>
            <div><dt>Reportes de molestias</dt><dd>{{ reports().length }}</dd></div>
            @if (isPhysio) { <div><dt>Antecedentes</dt><dd>{{ history().length }}</dd></div> }
            <div><dt>Alertas por revisar</dt><dd>{{ alertCounts().pending }}</dd></div>
            <div><dt>Seguimientos pendientes</dt><dd>{{ alertCounts().followUps }}</dd></div>
          </dl>
          @if (isPhysio && (alertCounts().pending || alertCounts().followUps)) {
            <a class="action-link" [routerLink]="[]" [queryParams]="{ tab: 'reviews' }" queryParamsHandling="merge">Abrir revisiones y seguimientos</a>
          } @else {
            <a class="action-link" [routerLink]="[]" [queryParams]="{ tab: 'program' }" queryParamsHandling="merge">Ver programa y ejercicios</a>
          }
          </div>
        </section>

        <section class="card span-2 athlete-facts" aria-labelledby="d-g">
          <h2 id="d-g">Datos generales</h2>
          <dl class="rows">
            <div><dt>Edad</dt><dd>{{ age() !== null ? age() + ' años' : 'Sin registrar' }}</dd></div>
            <div><dt>Peso</dt><dd>{{ d.profile.weightKg ? (+d.profile.weightKg) + ' kg' : 'Sin registrar' }}</dd></div>
            <div><dt>Categoría</dt><dd>{{ d.profile.category || 'Sin registrar' }}</dd></div>
            <div><dt>Estilo</dt><dd>{{ d.profile.style || 'Sin registrar' }}</dd></div>
            <div><dt>Experiencia</dt><dd>{{ d.profile.yearsExperience !== null ? d.profile.yearsExperience + ' años' : 'Sin registrar' }}</dd></div>
            <div><dt>Entrenador</dt><dd>{{ d.coachName || 'Sin asignar' }}</dd></div>
          </dl>
        </section>

      </div>
      <div class="cards" [hidden]="tab() !== 'history'">
        <section class="card span-2" aria-labelledby="d-d">
          <h2 id="d-d">Evolución del dolor</h2>
          @if (zones().length) {
            <div class="chips" role="group" aria-label="Zona del cuerpo">
              @for (z of zones(); track z) {
                <button type="button" class="chip" [class.on]="zone() === z" [attr.aria-pressed]="zone() === z"
                  (click)="zoneSel.set(z)">{{ z }}</button>
              }
            </div>
            <app-line-chart [points]="pain()" [max]="10" [ariaLabel]="'Evolución del dolor en ' + zone() + ', de 0 a 10'" />
          } @else {
            <app-state kind="empty" title="Sin reportes de dolor"
              text="Cuando este deportista reporte molestias, verás aquí su evolución." />
          }
        </section>

        <section class="card span-2" aria-labelledby="d-h">
          <div class="card-head">
            <h2 id="d-h">{{ isPhysio ? 'Reportes y antecedentes registrados' : 'Molestias reportadas' }}</h2>
            @if (isPhysio) { <a class="btn secondary sm" [routerLink]="[]" [queryParams]="{ tab: 'reviews' }" queryParamsHandling="merge">Ver revisiones de la ficha</a> }
          </div>
          @if (d.injuries.length) {
            <ul class="list">
              @for (i of d.injuries; track i.id) {
                <li [class.clinical-record]="isPhysio">
                  <div>
                    <strong>{{ i.bodyZone }}{{ i.injuryType ? ' · ' + i.injuryType : '' }}</strong>
                    <small>
                      {{ i.isHistory ? 'Antecedente · ' + formatHistoryDay(i.historyDate) : (isPhysio ? 'Molestia reportada · ' : '') + date(i.occurredAt) + ' · ' + limit(i.limitation) }}
                    </small>
                    <details class="disclosure"><summary>Consultar registro</summary>
                      @if(i.whenOccurs) { <p class="meta">Momento de aparición: {{ i.whenOccurs }}</p> }
                      @if(i.mechanism) { <p class="meta">Mecanismo: {{ i.mechanism }}</p> }
                      <p class="meta">{{ limit(i.limitation) }}</p>
                      @if(i.daysAbsent !== null) { <p class="meta">Días de ausencia registrados: {{ i.daysAbsent }}</p> }
                      @if(i.notes) { <p class="dlg-desc">{{ i.notes }}</p> }
                      @if(isPhysio) { @for(alert of i.alerts; track alert.id) { <a class="action-link" [routerLink]="['/equipo/alertas', alert.id]">Consultar alerta</a> } }
                    </details>
                  </div>
                  @if (!i.isHistory && i.intensity !== null) {
                    <span [class]="'badge ' + level(i.intensity)">{{ label(i.intensity) }} · {{ i.intensity }}/10</span>
                  } @else if (i.recurrent) {
                    <span class="badge mid">Recurrente</span>
                  }
                  @if (isPhysio && visited().has('history')) {
                    <app-injury-characterization [athleteId]="d.id" [injuryId]="i.id" />
                  }
                </li>
              }
            </ul>
          } @else {
            <app-state kind="empty" title="Sin historial" [text]="isPhysio ? 'Aún no hay reportes ni antecedentes registrados.' : 'Aún no hay molestias reportadas.'" />
          }
        </section>
      </div>
      @if (visited().has('program')) {
        <div class="cards" [hidden]="tab() !== 'program'">
          <nav class="program-jumps span-2" aria-label="Ir a una sección del programa">
            @if (d.program) { <button class="btn secondary sm" type="button" (click)="scroll.scrollToAnchor('athlete-program-progress')">Sesiones y avance</button> }
            <button class="btn secondary sm" type="button" (click)="scroll.scrollToAnchor('individual-exercises')">Ejercicios individuales</button>
          </nav>
          <app-athlete-program class="span-2" [athlete]="d" (saved)="load()"
            [assignmentState]="assignmentState()" [assignmentCount]="exercises()?.assignments()?.length ?? 0" />
          <app-athlete-exercises class="span-2" [athleteId]="d.id" [athleteName]="d.name" [injuries]="d.injuries" />
        </div>
      }
      @if (isPhysio && visited().has('reviews')) {
        <app-athlete-reviews [hidden]="tab() !== 'reviews'" [athleteId]="d.id" />
      }
      @if (isPhysio && visited().has('wellbeing')) {
        <app-wellbeing [hidden]="tab() !== 'wellbeing'" [athleteId]="d.id">
          @if (tab() === 'wellbeing') {
            <app-sleep-card class="stretch-card" [athleteId]="d.id" [highlight]="false" />
          }
        </app-wellbeing>
      }
      @if (!isPhysio && tab() === 'sleep') {
        <app-sleep-card [athleteId]="d.id" />
      }
      @if (isPhysio && visited().has('evaluations')) {
        <app-athlete-evaluations [hidden]="tab() !== 'evaluations'" [athleteId]="d.id">
          <nav evaluation-links class="evaluation-links" aria-label="Consultas de la intervención">
            <a class="action-link" [routerLink]="['/equipo/deportistas', d.id, 'informe']">Ver informe del programa</a>
            <a class="action-link" [routerLink]="['/equipo/deportistas', d.id, 'encuestas']">Ver encuestas</a>
          </nav>
        </app-athlete-evaluations>
      }
      @if (!isPhysio && tab() === 'summary') {
        <section class="survey-access" aria-labelledby="survey-access-title">
          <div>
            <h2 id="survey-access-title">Cuestionario del entrenador</h2>
            <p>Registra las prácticas preventivas de los entrenamientos del deportista.</p>
          </div>
          <a class="btn secondary" [routerLink]="['/equipo/deportistas', d.id, 'encuestas']">
            Abrir cuestionario
          </a>
        </section>
      }
    }
  `,
  styles: [`
    .athlete-summary { display: grid; gap: var(--space-form); }
    .summary-activity { border-block-start: 1px solid var(--line); padding-block-start: var(--space-form); }
    .summary-activity .stats { margin-block: .25rem .5rem; }
    .summary-activity .stats > div { padding-block: .4rem; align-items: baseline; }
    .summary-activity .stats dd { font-size: var(--text-card); }
    .summary-activity .action-link { display: inline-flex; align-items: center; min-block-size: var(--h); }
    @media (min-width: 680px) {
      .athlete-summary { grid-template-columns: minmax(14rem, .8fr) minmax(0, 1.2fr); }
      .summary-activity { border-block-start: 0; border-inline-start: 1px solid var(--line); padding: 0 0 0 var(--space-form); }
      .athlete-facts .rows { grid-template-columns: repeat(2,minmax(0,1fr)); column-gap: 1.5rem; }
      .athlete-facts .rows > div:nth-child(2) { border-top: 0; }
    }
    .evaluation-links { display: flex; flex-wrap: wrap; column-gap: 1rem; border-block-start: 1px solid var(--line); }
    .evaluation-links a { display: inline-flex; align-items: center; min-block-size: var(--h); }
    .clinical-record { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; }
    .clinical-record > app-injury-characterization { grid-column: 1 / -1; min-width: 0; }
    .clinical-record > div { min-width: 0; overflow-wrap: anywhere; }
    .survey-access {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
      gap: .75rem 1rem; margin-block-start: 1rem; padding-block-start: 1rem;
      border-block-start: 1px solid var(--line);
    }
    h2#survey-access-title { margin: 0; font-size: var(--text-section); }
    .survey-access p { margin: .25rem 0 0; }
  `],
})
export class AthleteDetailPage {
  protected readonly formatHistoryDay = formatHistoryDay;
  scroll = inject(ViewportScroller);
  private api = inject(TeamAthleteApi);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private id = '';
  private request?: Subscription;
  isPhysio = inject(AuthService).user()?.role === 'PHYSIO';
  sections = [
    { id: 'summary', label: 'Resumen' }, { id: 'history', label: this.isPhysio ? 'Antecedentes y molestias' : 'Molestias' },
    ...(this.isPhysio ? [{ id: 'reviews', label: 'Revisiones y seguimientos' }] : []),
    { id: 'program', label: 'Programa y ejercicios' },
    ...(this.isPhysio ? [{ id: 'evaluations', label: 'Evaluaciones' }, { id: 'wellbeing', label: 'Bienestar' }] : [{ id: 'sleep', label: 'Sueño' }])
  ];
  exercises = viewChild(AthleteExercises);
  assignmentState = computed(() => {
    const exercises = this.exercises();
    if (!exercises || exercises.aLoading()) return 'loading';
    return exercises.aFailed() ? 'error' : 'ready';
  });
  tab = signal('summary');
  visited = signal(new Set(['summary']));

  d = signal<Detail | null>(null);
  loading = signal(true);
  failed = signal(false);
  notFound = signal(false);
  zoneSel = signal<string | null>(null);

  alertCounts = computed(() => {
    const alerts = (this.d()?.injuries ?? []).flatMap(injury => injury.alerts ?? []);
    return {pending: alerts.filter(alert => alert.status === 'NEW' || alert.status === 'IN_REVIEW').length,
      followUps: alerts.filter(alert => alert.status === 'FOLLOW_UP_PENDING').length};
  });
  reports = computed(() =>
    (this.d()?.injuries ?? []).filter((i) => !i.isHistory).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  );
  history = computed(() => (this.d()?.injuries ?? []).filter((i) => i.isHistory));
  zones = computed(() => {
    const seen: string[] = [];
    for (const r of [...this.reports()].reverse()) {
      if (r.intensity !== null && !seen.includes(r.bodyZone)) seen.push(r.bodyZone);
    }
    return seen;
  });
  zone = computed(() => this.zoneSel() ?? this.zones()[0] ?? null);
  pain = computed<ChartPoint[]>(() =>
    this.reports()
      .filter((r) => r.bodyZone === this.zone() && r.intensity !== null)
      .map((r) => ({ label: fmtDate(r.occurredAt), value: r.intensity as number }))
  );
  subtitle = computed(() => {
    const p = this.d()?.profile;
    return [p?.category, p?.style].filter(Boolean).join(' · ') || (this.d()?.email ?? '');
  });
  age = computed(() => {
    const b = this.d()?.profile.birthDate;
    if (!b) return null;
    const bd = new Date(b), n = new Date();
    let a = n.getFullYear() - bd.getFullYear();
    const m = n.getMonth() - bd.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < bd.getDate())) a--;
    return a;
  });

  level = painLevel;
  label(n: number) { return PAIN_LABEL[painLevel(n)]; }
  limit(l: Injury['limitation']) { return LIMIT_LABEL[l]; }
  date = fmtDate;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.id = params.get('id') ?? '';
      this.visited.set(new Set(['summary', this.tab()]));
      this.zoneSel.set(null);
      this.load();
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const requested = params.get('tab');
      const next = this.sections.some(section => section.id === requested) ? requested! : 'summary';
      this.tab.set(next);
      this.visited.update(seen => new Set([...seen, next]));
    });
  }

  back() { this.router.navigateByUrl('/equipo/deportistas'); }

  load() {
    this.loading.set(true);
    this.failed.set(false);
    this.notFound.set(false);
    this.request?.unsubscribe();
    this.request = this.api.detail(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => { this.d.set(d); this.loading.set(false); },
      error: (e) => {
        this.notFound.set(e?.status === 404);
        this.failed.set(true);
        this.loading.set(false);
      }
    });
  }

}
