import { Component, computed, inject, signal } from '@angular/core';
import { Status, TeamStore, statusOf } from '../core/team-store';
import { StateView } from '../core/state';
import { AthleteRow } from './athlete-row';

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

@Component({
  selector: 'app-team-athletes',
  imports: [StateView, AthleteRow],
  template: `
    <header class="page-head">
      <h1>Deportistas</h1>
      <p class="sub">{{ store.athletes().length }} {{ store.athletes().length === 1 ? 'deportista' : 'deportistas' }} en seguimiento</p>
    </header>

    @if (store.failed()) {
      <app-state kind="error" title="No pudimos cargar los deportistas"
        text="Revisa tu conexión e inténtalo de nuevo." action="Reintentar" (act)="store.load()" />
    } @else if (store.loading()) {
      <div class="stack" aria-busy="true" aria-label="Cargando">
        <div class="sk sk-ath"></div><div class="sk sk-ath"></div><div class="sk sk-ath"></div>
      </div>
    } @else if (!store.athletes().length) {
      <div class="card">
        <app-state kind="empty" title="Aún no hay deportistas"
          text="Cuando se asignen deportistas a tu cuenta, aparecerán aquí." />
      </div>
    } @else {
      <div class="toolbar">
        <div class="field">
          <label for="t-q">Buscar deportista</label>
          <input id="t-q" type="search" placeholder="Nombre" [value]="q()" (input)="q.set($any($event.target).value)" />
        </div>
        <div class="chips" role="group" aria-label="Filtrar por estado">
          @for (f of filters; track f.v) {
            <button type="button" class="chip" [class.on]="filter() === f.v" [attr.aria-pressed]="filter() === f.v"
              (click)="filter.set(f.v)">{{ f.label }}</button>
          }
        </div>
      </div>

      @if (filtered().length) {
        <ul class="ath-list">
          @for (a of filtered(); track a.id) { <li><app-athlete-row [a]="a" /></li> }
        </ul>
      } @else {
        <div class="card">
          <app-state kind="empty" title="Sin resultados" text="Prueba con otro nombre o cambia el filtro." />
        </div>
      }
    }
  `
})
export class TeamAthletesPage {
  store = inject(TeamStore);

  q = signal('');
  filter = signal<'all' | Status>('all');
  filters: { v: 'all' | Status; label: string }[] = [
    { v: 'all', label: 'Todos' },
    { v: 'review', label: 'Revisar' },
    { v: 'low', label: 'Baja adherencia' },
    { v: 'ok', label: 'Al día' }
  ];

  filtered = computed(() => {
    const q = norm(this.q().trim());
    const f = this.filter();
    return this.store.athletes().filter(
      (a) => (!q || norm(a.name).includes(q)) && (f === 'all' || statusOf(a) === f)
    );
  });
}