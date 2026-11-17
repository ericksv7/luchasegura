import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { STATUS_BADGE, STATUS_LABEL, TeamAthlete, ago, initialsOf, statusOf } from '../core/team-store';

@Component({
  selector: 'app-athlete-row',
  imports: [RouterLink],
  template: `
    <a class="ath" [routerLink]="['/equipo/deportistas', a().id]">
      <span class="avatar" aria-hidden="true">{{ initials() }}</span>
      <span class="ath-name">
        <strong>{{ a().name }}</strong>
        <small>{{ a().week ? 'Semana ' + a().week : 'Sin programa' }}</small>
      </span>
      <span [class]="'ath-badge badge ' + badge()">{{ label() }}</span>
      <span class="ath-prog">
        @if (a().planned > 0) {
          <span class="bar" role="progressbar" aria-label="Cumplimiento" aria-valuemin="0" aria-valuemax="100"
            [attr.aria-valuenow]="a().compliance"><i [style.width.%]="a().compliance"></i></span>
          <b>{{ a().compliance }}%</b>
        } @else {
          <small>Sin sesiones aún</small>
        }
      </span>
      <span class="ath-last">
        @if (a().lastReport; as r) {
          {{ r.zone }}{{ r.intensity !== null ? ' ' + r.intensity + '/10' : '' }} · {{ ago(r.at) }}
        } @else {
          Sin reportes
        }
      </span>
    </a>
  `
})
export class AthleteRow {
  a = input.required<TeamAthlete>();
  initials = computed(() => initialsOf(this.a().name));
  badge = computed(() => STATUS_BADGE[statusOf(this.a())]);
  label = computed(() => STATUS_LABEL[statusOf(this.a())]);
  ago = ago;
}