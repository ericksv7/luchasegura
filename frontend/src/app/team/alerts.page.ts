import { forkJoin } from 'rxjs';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LIMIT_LABEL, PAIN_LABEL, painLevel } from '../core/athlete-store';
import { ALERT_ACTION, ALERT_LABEL, AlertApi, AlertCounts, ReviewAlert } from '../core/alert-api';
import { AuthService, apiError } from '../core/auth.service';
import { TeamAlert, TeamStore, ago } from '../core/team-store';
import { StateView } from '../core/state';

@Component({
  selector: 'app-team-alerts',
  imports: [RouterLink, StateView, DatePipe],
  template: `
    <div class="alerts-entry">
    <header class="page-head">
      <h1>Alertas</h1>
      <p class="sub">Reportes que generaron una alerta según los umbrales registrados.</p>
    </header>
    @if (isPhysio) {
      <div class="kpis review-stack alert-kpis" aria-label="Indicadores de alertas">
        @if (!counts() && loading()) {
          <div class="sk sk-kpi"></div><div class="sk sk-kpi"></div><div class="sk sk-kpi"></div><div class="sk sk-kpi"></div>
        } @else if (counts(); as counts) {
          <a class="kpi action-link" [class.alert]="counts.pending > 0" routerLink="/equipo/alertas" [queryParams]="{status:'PENDING',athleteId:athleteId}"><span>Por revisar</span><strong>{{ counts.pending }}</strong></a>
          <a class="kpi action-link" [class.warn]="counts.followUps > 0" routerLink="/equipo/alertas" [queryParams]="{status:'FOLLOW_UP_PENDING',athleteId:athleteId}"><span>Seguimientos pendientes</span><strong>{{ counts.followUps }}</strong></a>
          <a class="kpi action-link" routerLink="/equipo/alertas" [queryParams]="{status:'REVIEWED',athleteId:athleteId}"><span>Revisiones registradas</span><strong>{{ counts.reviewed }}</strong></a>
          <a class="kpi action-link" routerLink="/equipo/alertas" [queryParams]="{status:'ALL',athleteId:athleteId}"><span>Total</span><strong>{{ counts.total }}</strong></a>
        }
      </div>
      <div class="toolbar">
        <div class="field"><label for="alert-search">Buscar deportista o zona</label><input id="alert-search" type="search" [value]="query()" (input)="query.set($any($event.target).value)" placeholder="Nombre o zona corporal" /></div>
        <div class="field">
          <label for="alert-status">Estado de la alerta</label>
          <select id="alert-status" (change)="filter($any($event.target).value)">
            <option value="PENDING" [selected]="status() === 'PENDING'">Pendientes de revisión</option><option value="ALL" [selected]="status() === 'ALL'">Todos los estados</option>
            @for (s of statuses; track s) { <option [value]="s" [selected]="status() === s">{{ labels[s] }}</option> }
          </select>
        </div>
        @if (athleteId) { <p class="meta">Alertas del deportista seleccionado. <a routerLink="/equipo/alertas" [queryParams]="{ status: 'ALL' }">Ver todos los deportistas</a></p> }
      </div>
    } @else {
      <p class="notice">La revisión profesional está reservada al fisioterapeuta. Puedes consultar la ficha de tus deportistas.</p>
    }
    @if (failed()) {
      <app-state kind="error" title="No pudimos cargar las alertas" [text]="error()" action="Reintentar" (act)="load()" />
    } @else if (loading()) {
      <div class="stack" aria-busy="true" aria-label="Cargando alertas"><div class="sk sk-card"></div><div class="sk sk-card"></div></div>
    } @else if (items().length) {
      <ul class="stack plain review-stack">
        @for (a of items(); track a.id) {
          <li class="card alert-card alert-work-row">
            <div class="alert-top">
              <div>
                <a class="alert-name" [routerLink]="['/equipo/deportistas', a.athleteId]">{{ a.athleteName }}</a>
                <small>{{ a.zone }} · {{ ago(a.createdAt) }}</small>
              </div>
              @if (a.intensity !== null) { <span [class]="'badge ' + level(a.intensity)">{{ painLabel(a.intensity) }} · {{ a.intensity }}/10</span> }
            </div>
            <p class="meta">{{ limit(a.limitation) }}{{ a.whenOccurs ? ' · Aparece: ' + a.whenOccurs : '' }}</p>
            <div class="exc-meta"><span class="badge" [class.low]="a.status === 'REVIEWED'" [class.mid]="a.status !== 'REVIEWED'">{{ labels[a.status] }}</span></div>
            @if (followUp(a); as date) { <p class="meta follow-up-date">Seguimiento sugerido: {{ date | date:'dd/MM/yyyy':'UTC' }}</p> }
            @if (isPhysio) {
              <a class="btn sm alert-primary" [routerLink]="['/equipo/alertas', a.id]">{{ actions[a.status] }}</a>
            }
          </li>
        }
      </ul>
    } @else {
      <div class="card"><app-state kind="success" title="Sin alertas en esta consulta" [text]="isPhysio ? (query() ? 'Prueba con otro nombre o zona, o cambia el estado seleccionado.' : 'Cambia el estado para consultar otras alertas.') : 'Aquí aparecerán las alertas por revisar de tus deportistas asignados.'" /></div>
    }
    </div>
  `
})
export class TeamAlertsPage {
  private store = inject(TeamStore);
  private api = inject(AlertApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  isPhysio = inject(AuthService).user()?.role === 'PHYSIO';
  athleteId: string | null = null;
  status = signal('PENDING');
  private alerts = signal<ReviewAlert[]>([]);
  counts = signal<AlertCounts | null>(null);
  private busy = signal(true);
  private loadFailed = signal(false);
  error = signal('Revisa tu conexión e inténtalo de nuevo.');
  query = signal('');
  items = computed<(ReviewAlert | TeamAlert)[]>(() => {
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const query = normalize(this.query().trim());
    return (this.isPhysio ? this.alerts() : this.store.alerts()).filter(alert => !query || normalize(alert.athleteName + ' ' + alert.zone).includes(query));
  });
  loading = computed(() => this.isPhysio ? this.busy() : this.store.loading());
  failed = computed(() => this.isPhysio ? this.loadFailed() : this.store.failed());
  statuses = ['NEW', 'IN_REVIEW', 'REVIEWED', 'FOLLOW_UP_PENDING'] as const;
  labels = ALERT_LABEL;
  actions = ALERT_ACTION;
  level = painLevel;
  painLabel(n: number) { return PAIN_LABEL[painLevel(n)]; }
  limit(l: TeamAlert['limitation']) { return LIMIT_LABEL[l]; }
  ago = ago;
  followUp(a: ReviewAlert | TeamAlert) { return 'followUpDate' in a ? a.followUpDate : null; }
  private request?: { unsubscribe(): void };

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const athleteId = params.get('athleteId');
      if (athleteId !== this.athleteId) this.counts.set(null);
      this.athleteId = athleteId;
      const status = params.get('status') ?? 'PENDING';
      this.status.set(['PENDING', 'ALL', ...this.statuses].includes(status) ? status : 'PENDING');
      if (this.isPhysio) this.load();
    });
  }
  filter(status: string) {
    this.router.navigate([], { relativeTo: this.route, queryParams: { status }, queryParamsHandling: 'merge' });
  }
  load() {
    if (!this.isPhysio) { this.store.load(); return; }
    this.request?.unsubscribe(); this.busy.set(true); this.loadFailed.set(false);
    this.request = forkJoin({alerts: this.api.list(this.status(), this.athleteId), counts: this.api.counts(this.athleteId)}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({alerts, counts}) => { this.alerts.set(alerts); this.counts.set(counts); this.busy.set(false); },
      error: (e) => { this.error.set(apiError(e)); this.loadFailed.set(true); this.busy.set(false); }
    });
  }
}
