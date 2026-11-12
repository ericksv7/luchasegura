import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LIMIT_LABEL, PAIN_LABEL, painLevel } from '../core/athlete-store';
import { TeamAlert, TeamStore, ago } from '../core/team-store';
import { StateView } from '../core/state';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-team-alerts',
  imports: [RouterLink, StateView],
  template: `
    <header class="page-head">
      <h1>Alertas</h1>
      <p class="sub">Molestias que superaron el umbral de dolor.</p>
    </header>

    @if (store.failed()) {
      <app-state kind="error" title="No pudimos cargar las alertas"
        text="Revisa tu conexión e inténtalo de nuevo." action="Reintentar" (act)="store.load()" />
    } @else if (store.loading()) {
      <div class="stack" aria-busy="true" aria-label="Cargando">
        <div class="sk sk-card"></div><div class="sk sk-card"></div>
      </div>
    } @else if (store.alerts().length) {
      <ul class="stack plain">
        @for (a of store.alerts(); track a.id) {
          <li class="card alert-card">
            <div class="alert-top">
              <div>
                <a class="alert-name" [routerLink]="['/equipo/deportistas', a.athleteId]">{{ a.athleteName }}</a>
                <small>{{ a.zone }} · {{ ago(a.createdAt) }}</small>
              </div>
              @if (a.intensity !== null) {
                <span [class]="'badge ' + level(a.intensity)">{{ label(a.intensity) }} · {{ a.intensity }}/10</span>
              }
            </div>
            <p class="meta">{{ limit(a.limitation) }}{{ a.whenOccurs ? ' · Aparece: ' + a.whenOccurs : '' }}</p>
            <button type="button" class="btn secondary sm" (click)="review(a)"
              [attr.aria-label]="'Marcar como revisada la alerta de ' + a.athleteName">Marcar como revisada</button>
          </li>
        }
      </ul>
    } @else {
      <div class="card">
        <app-state kind="success" title="Todo al día" text="No hay alertas por revisar." />
      </div>
    }
  `
})
export class TeamAlertsPage {
  store = inject(TeamStore);
  private toast = inject(ToastService);

  level = painLevel;
  label(n: number) { return PAIN_LABEL[painLevel(n)]; }
  limit(l: TeamAlert['limitation']) { return LIMIT_LABEL[l]; }
  ago = ago;

  review(a: TeamAlert) {
    this.store.review(a.id, (msg) => this.toast.error(msg));
    this.toast.success('Alerta revisada');
  }
}