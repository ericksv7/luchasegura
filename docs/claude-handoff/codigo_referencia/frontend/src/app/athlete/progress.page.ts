import { Component, computed, inject, signal } from '@angular/core';
import { AthleteStore } from '../core/athlete-store';
import { BarChart, LineChart, ProgressRing } from '../core/charts';
import { StateView } from '../core/state';

@Component({
  selector: 'app-progress',
  imports: [ProgressRing, LineChart, BarChart, StateView],
  template: `
    <header class="page-head">
      <h1>Mi progreso</h1>
      <p class="sub">Cumplimiento del programa y evolución del dolor.</p>
    </header>

    @if (store.failed()) {
      <app-state kind="error" title="No pudimos cargar tu progreso"
        text="Revisa tu conexión e inténtalo de nuevo." action="Reintentar" (act)="store.load()" />
    } @else if (store.loading()) {
      <div class="cards" aria-busy="true" aria-label="Cargando">
        <div class="sk sk-card"></div><div class="sk sk-card"></div>
        <div class="sk sk-chart span-2"></div><div class="sk sk-chart span-2"></div>
      </div>
    } @else {
      <div class="cards">
        <section class="card" aria-labelledby="h-c">
          <h2 id="h-c">Cumplimiento</h2>
          @if (store.program()) {
            <div class="ring-row">
              <app-progress-ring [value]="store.compliance()"
                [ariaLabel]="'Cumplimiento del programa: ' + store.compliance() + ' por ciento'" />
              <p class="ring-meta"><strong>{{ store.doneToDate() }} de {{ store.plannedToDate() }}</strong> sesiones hasta hoy</p>
            </div>
          } @else {
            <p class="meta">Se mostrará cuando tengas un programa.</p>
          }
        </section>

        <section class="card" aria-labelledby="h-r">
          <h2 id="h-r">Resumen</h2>
          <dl class="stats">
            <div><dt>Sesiones completadas</dt><dd>{{ store.doneTotal() }}</dd></div>
            <div><dt>Semana actual</dt><dd>{{ store.currentWeek() }}</dd></div>
            <div><dt>Reportes de molestias</dt><dd>{{ store.reports().length }}</dd></div>
          </dl>
        </section>

        <section class="card span-2" aria-labelledby="h-s">
          <h2 id="h-s">Sesiones por semana</h2>
          @if (store.program(); as p) {
            <p class="meta">La línea punteada marca la meta de {{ p.sessionsPerWeek }} sesiones.</p>
            <app-bar-chart [bars]="store.weekBars()" [max]="p.sessionsPerWeek" [target]="p.sessionsPerWeek"
              ariaLabel="Sesiones completadas por semana del programa" />
          } @else {
            <app-state kind="empty" title="Sin programa asignado" text="Aquí verás tus sesiones cuando haya un programa." />
          }
        </section>

        <section class="card span-2" aria-labelledby="h-d">
          <h2 id="h-d">Evolución del dolor</h2>
          @if (store.zones().length) {
            <div class="chips" role="group" aria-label="Zona del cuerpo">
              @for (z of store.zones(); track z) {
                <button type="button" class="chip" [class.on]="zone() === z" [attr.aria-pressed]="zone() === z"
                  (click)="zoneSel.set(z)">{{ z }}</button>
              }
            </div>
            <app-line-chart [points]="pain()" [max]="10" [ariaLabel]="'Evolución del dolor en ' + zone() + ', de 0 a 10'" />
          } @else {
            <app-state kind="empty" title="Sin datos de dolor"
              text="Cuando reportes molestias con su intensidad, verás aquí cómo evolucionan." />
          }
        </section>

        <section class="card span-2" aria-labelledby="h-p">
          <h2 id="h-p">Pruebas funcionales</h2>
          <app-state kind="empty" title="Aún no hay resultados"
            text="Tu fisioterapeuta cargará aquí los resultados de la evaluación inicial y la final." />
        </section>
      </div>
    }
  `
})
export class ProgressPage {
  store = inject(AthleteStore);
  zoneSel = signal<string | null>(null);
  zone = computed(() => this.zoneSel() ?? this.store.zones()[0] ?? null);
  pain = computed(() => this.store.painFor(this.zone()));
}