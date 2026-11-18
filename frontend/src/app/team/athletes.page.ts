import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
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
      <p class="sub">Busca por nombre y abre una ficha para consultar el avance y la actividad del deportista.</p>
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
              (click)="setFilter(f.v)">{{ f.label }}</button>
          }
        </div>
      </div>

      @if (filtered().length) {
        <p class="results-line" role="status">{{ filtered().length }} de {{ store.athletes().length }} deportistas</p>
        <ul class="ath-list">
          @for (a of filtered(); track a.id) { <li><app-athlete-row [a]="a" /></li> }
        </ul>
      } @else {
        <div class="card">
          <app-state kind="empty" title="Sin resultados" text="Prueba con otro nombre o cambia el filtro." action="Limpiar filtros" (act)="q.set(''); setFilter('all')" />
        </div>
      }
    }
  `
})
export class TeamAthletesPage {
  store = inject(TeamStore);

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const value = params.get('status');
      this.filter.set(this.filters.some(f => f.v === value) ? value as 'all' | Status : 'all');
    });
  }
  setFilter(status: 'all' | Status) { this.router.navigate([], { relativeTo: this.route, queryParams: {status: status === 'all' ? null : status}, queryParamsHandling: 'merge' }); }
  q = signal('');
  filter = signal<'all' | Status>('all');
  filters: { v: 'all' | Status; label: string }[] = [
    { v: 'all', label: 'Todos' },
    { v: 'review', label: 'Revisar' },
    { v: 'followUp', label: 'Seguimiento pendiente' },
    { v: 'low', label: 'Baja adherencia' },
    { v: 'notStarted', label: 'Sin iniciar' },
    { v: 'ok', label: 'Al día' }
  ];

  filtered = computed(() => {
    const q = norm(this.q().trim());
    const f = this.filter();
    return this.store.athletes().filter(
      (a) => (!q || norm(a.name).includes(q)) && (f === 'all' || (f === 'low' ? a.lowAdherence : f === 'review' ? a.newAlerts > 0 : f === 'followUp' ? (a.followUpAlerts ?? 0) > 0 : statusOf(a) === f))
    );
  });
}