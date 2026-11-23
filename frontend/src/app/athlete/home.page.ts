import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { AthleteStore, LIMIT_LABEL, PAIN_LABEL, ProgramSession, componentsOf, fmtDate, painLevel } from '../core/athlete-store';
import { BarChart, LineChart, ProgressRing } from '../core/charts';
import { StateView } from '../core/state';
import { HomeWellbeing } from './home-wellbeing';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ProgressRing, LineChart, BarChart, StateView, HomeWellbeing],
  template: `
    <header class="page-head">
      <p class="eyebrow">{{ today }}</p>
      <h1>Hola, {{ firstName() }}</h1>
      <p class="sub">Consulta tu próxima sesión, revisa tu avance o registra una molestia.</p>
    </header>

    @if (store.failed()) {
      <app-state kind="error" title="No pudimos cargar tu información"
        text="Revisa tu conexión e inténtalo de nuevo." action="Reintentar" (act)="store.load()" />
      <div class="home-secondary home-secondary-fallback"><app-home-wellbeing /></div>
    } @else if (store.loading()) {
      <div class="cards" aria-busy="true" aria-label="Cargando">
        <div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-card"></div>
        <div class="sk sk-chart span-2"></div><div class="sk sk-chart span-2"></div>
      </div>
    } @else {
      <div class="cards home-cards">
        <section class="card card-hero" aria-labelledby="h-hoy">
          @if (store.program(); as p) {
            <p class="eyebrow">{{ p.currentWeek ? 'Semana ' + p.currentWeek + ' de ' + p.weeks : 'Programa sin iniciar' }}</p>
            @if (!p.currentWeek) {
              <h2 id="h-hoy">Inicio de intervención pendiente</h2><p>El equipo de fisioterapia debe registrar la fecha real de inicio. Tus sesiones completadas se conservan.</p>
            } @else if (store.nextSession(); as s) {
              <h2 id="h-hoy">Tu próxima sesión · {{ s.number }}</h2>
              <p>{{ s.minutes ? s.minutes + ' min' : '' }}{{ s.minutes && components(s) ? ' · ' : '' }}{{ components(s) }}</p>
              <a class="btn" routerLink="/deportista/plan">Ver mi plan</a>
            } @else {
              <h2 id="h-hoy">Completaste esta semana</h2>
              <p>Buen trabajo. Las próximas sesiones se habilitan la semana que viene.</p>
              <a class="btn secondary" routerLink="/deportista/progreso">Ver mi progreso</a>
            }
          } @else {
            <h2 id="h-hoy">Sin programa asignado</h2>
            <p>Cuando el equipo de fisioterapia cargue el programa, aparecerá aquí.</p>
          }
        </section>

        <section class="card" aria-labelledby="h-cump">
          <h2 id="h-cump">Avance del programa</h2>
          @if (store.program() && store.plannedToDate() > 0) {
            <div class="ring-row">
              <app-progress-ring [value]="store.compliance()"
                [ariaLabel]="'Cumplimiento del programa: ' + store.compliance() + ' por ciento'" />
              <p class="ring-meta"><strong>{{ store.doneToDate() }} de {{ store.plannedToDate() }}</strong> sesiones hasta hoy</p>
            </div>
          } @else {
            <p class="meta">Se mostrará cuando comience la intervención y haya sesiones previstas.</p>
          }
        </section>

        <section class="card" aria-labelledby="h-ult">
          <h2 id="h-ult">Última molestia</h2>
          @if (store.lastReport(); as r) {
            <div class="last">
              <strong>{{ r.bodyZone }}</strong>
              @if (r.intensity !== null) {
                <span class="badge" [class]="'badge ' + level(r.intensity)">{{ label(r.intensity) }} · {{ r.intensity }}/10</span>
              }
            </div>
            <p class="meta">{{ date(r.occurredAt) }} · {{ limit(r.limitation) }}</p>
            <a class="btn secondary" routerLink="/deportista/reportar">Reportar molestia</a>
          } @else {
            <app-state kind="empty" title="Sin molestias reportadas"
              text="Si sientes una molestia, regístrala aquí." action="Reportar molestia" (act)="go('/deportista/reportar')" />
          }
        </section>

        <div class="home-secondary">
          <app-home-wellbeing />
          <section class="card pain-summary" aria-labelledby="h-dolor">
            <h2 id="h-dolor">Evolución del dolor</h2>
            @if (pain().length) {
              <p class="meta">{{ zone() }} · últimos reportes</p>
              <app-line-chart [points]="pain()" [max]="10"
                [ariaLabel]="'Evolución del dolor en ' + zone() + ', de 0 a 10'" />
            } @else {
              <p class="meta">Aún no hay reportes con intensidad para graficar.</p>
            }
          </section>
        </div>

        <section class="card span-2" aria-labelledby="h-ses">
          <h2 id="h-ses">Sesiones por semana</h2>
          @if (store.program(); as p) {
            <p class="meta">La línea punteada marca la meta de {{ p.sessionsPerWeek }} sesiones.</p>
            <app-bar-chart [bars]="store.weekBars()" [max]="p.sessionsPerWeek" [target]="p.sessionsPerWeek"
              ariaLabel="Sesiones completadas por semana del programa" />
          } @else {
            <p class="meta">Se mostrará cuando comience la intervención y haya sesiones previstas.</p>
          }
        </section>
      </div>
    }
  `,
  styles: [`
    :host { display: block; container-type: inline-size; }
    .home-cards > .card-hero > :is(h2, p) { margin-block-end: 0; }
    .home-secondary { grid-column: 1 / -1; display: grid; gap: 14px; }
    .home-secondary > app-home-wellbeing { display: grid; }
    .home-secondary-fallback { margin-block-start: 14px; }
    .pain-summary { min-inline-size: 0; }
    @container (min-width: 620px) {
      .home-secondary { grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); }
    }
    @container (min-width: 868px) {
      .home-secondary { grid-template-columns: minmax(0, calc((100% - 28px) / 3)) minmax(0, 1fr); }
    }
  `],
})
export class HomePage {
  store = inject(AthleteStore);
  private auth = inject(AuthService);
  private router = inject(Router);

  today = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  firstName = computed(() => (this.auth.user()?.fullName ?? '').split(' ')[0]);
  zone = computed(() => this.store.lastReport()?.bodyZone ?? null);
  pain = computed(() => this.store.painFor(this.zone()).slice(-8));

  components(s: ProgramSession) { return componentsOf(s).join(' · '); }
  level = painLevel;
  label(n: number) { return PAIN_LABEL[painLevel(n)]; }
  limit(l: 'NONE' | 'PARTIAL' | 'FULL') { return LIMIT_LABEL[l]; }
  date = fmtDate;
  go(path: string) { this.router.navigateByUrl(path); }
}