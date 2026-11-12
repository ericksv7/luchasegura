import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { PAIN_LABEL, painLevel } from '../core/athlete-store';
import { TeamStore, ago } from '../core/team-store';
import { StateView } from '../core/state';
import { AthleteRow } from './athlete-row';

@Component({
  selector: 'app-team-overview',
  imports: [RouterLink, StateView, AthleteRow],
  template: `
    <header class="page-head">
      <p class="eyebrow">{{ today }}</p>
      <h1>Resumen</h1>
      <p class="sub">{{ scope() }}</p>
    </header>

    @if (store.failed()) {
      <app-state kind="error" title="No pudimos cargar el resumen"
        text="Revisa tu conexión e inténtalo de nuevo." action="Reintentar" (act)="store.load()" />
    } @else if (store.loading()) {
      <div class="kpis" aria-busy="true" aria-label="Cargando">
        <div class="sk sk-kpi"></div><div class="sk sk-kpi"></div><div class="sk sk-kpi"></div><div class="sk sk-kpi"></div>
      </div>
      <div class="stack section"><div class="sk sk-ath"></div><div class="sk sk-ath"></div><div class="sk sk-ath"></div></div>
    } @else if (store.stats(); as s) {
      <div class="kpis">
        <div class="kpi"><span>Deportistas</span><strong>{{ s.athletes }}</strong></div>
        <div class="kpi"><span>Cumplimiento promedio</span><strong>{{ s.avgCompliance }}%</strong></div>
        <div class="kpi" [class.alert]="s.newAlerts > 0"><span>Alertas por revisar</span><strong>{{ s.newAlerts }}</strong></div>
        <div class="kpi" [class.warn]="s.lowAdherence > 0"><span>Con baja adherencia</span><strong>{{ s.lowAdherence }}</strong></div>
      </div>

      @if (s.athletes === 0) {
        <div class="card section">
          <app-state kind="empty" title="Aún no hay deportistas"
            text="Cuando se asignen deportistas a tu cuenta, aparecerán aquí." />
        </div>
      } @else {
        <section class="section" aria-labelledby="h-al">
          <div class="section-head">
            <h2 id="h-al">Alertas por revisar</h2>
            @if (store.alerts().length) { <a routerLink="/equipo/alertas">Ver todas</a> }
          </div>
          @if (store.alerts().length) {
            <ul class="card list">
              @for (a of top(); track a.id) {
                <li>
                  <div>
                    <strong>{{ a.athleteName }}</strong>
                    <small>{{ a.zone }} · {{ ago(a.createdAt) }}</small>
                  </div>
                  @if (a.intensity !== null) {
                    <span [class]="'badge ' + level(a.intensity)">{{ label(a.intensity) }} · {{ a.intensity }}/10</span>
                  }
                </li>
              }
            </ul>
          } @else {
            <div class="card"><app-state kind="success" title="Todo al día" text="No hay alertas por revisar." /></div>
          }
        </section>

        <section class="section" aria-labelledby="h-at">
          <div class="section-head">
            <h2 id="h-at">Necesitan atención</h2>
            <a routerLink="/equipo/deportistas">Ver todos</a>
          </div>
          @if (store.attention().length) {
            <ul class="ath-list">
              @for (a of store.attention().slice(0, 5); track a.id) {
                <li><app-athlete-row [a]="a" /></li>
              }
            </ul>
          } @else {
            <div class="card"><app-state kind="success" title="Nadie necesita atención" text="Todos los deportistas van al día con el programa." /></div>
          }
        </section>
      }
    }
  `
})
export class TeamOverviewPage {
  store = inject(TeamStore);
  private auth = inject(AuthService);

  today = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  scope = computed(() =>
    this.auth.user()?.role === 'PHYSIO' ? 'Todos los deportistas del proyecto.' : 'Tus deportistas asignados.'
  );
  top = computed(() => this.store.alerts().slice(0, 3));

  level = painLevel;
  label(n: number) { return PAIN_LABEL[painLevel(n)]; }
  ago = ago;
}