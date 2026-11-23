import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { timer } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { PAIN_LABEL, painLevel } from '../core/athlete-store';
import { TeamStore, ago } from '../core/team-store';
import { ALERT_ACTION } from '../core/alert-api';
import { bogotaDay } from '../core/civil-date';
import { StateView } from '../core/state';
import { AthleteRow } from './athlete-row';
import { TeamReportPanel } from './team-report-panel';

const headingDate = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
});

@Component({
  selector: 'app-team-overview',
  imports: [RouterLink, StateView, AthleteRow, DatePipe, TeamReportPanel],
  template: `
    <header class="page-head">
      <p class="eyebrow">{{ today() }}</p>
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
      @if (store.refreshFailed()) { <p class="notice" role="status">No se pudo actualizar el resumen. Se conserva la última información confirmada. <button type="button" class="btn secondary sm" (click)="store.load()">Reintentar</button></p> }
      <div class="kpis">
        <a class="kpi action-link" routerLink="/equipo/deportistas"><span>Deportistas</span><strong>{{ s.athletes }}</strong></a>
        <a class="kpi action-link" routerLink="/equipo/deportistas"><span>Cumplimiento promedio</span><strong>{{ hasStarted() ? s.avgCompliance + '%' : '—' }}</strong></a>
        <div class="kpi" [class.alert]="s.newAlerts > 0"><a class="kpi-label action-link" routerLink="/equipo/alertas" [queryParams]="{status: 'PENDING'}">Alertas por revisar</a><strong>{{ s.newAlerts }}</strong>@if (isPhysio) { <a class="meta action-link" routerLink="/equipo/alertas" [queryParams]="{ status: 'FOLLOW_UP_PENDING' }">{{ s.followUpAlerts ?? 0 }} seguimientos pendientes</a> }</div>
        <a class="kpi action-link" [class.warn]="s.lowAdherence > 0" routerLink="/equipo/deportistas" [queryParams]="{status: 'low'}"><span>Con baja adherencia</span><strong>{{ s.lowAdherence }}</strong></a>
      </div>

      @if (isPhysio) { <app-team-report-panel [athletes]="store.athletes()" /> }

      @if (s.athletes === 0) {
        <div class="card section">
          <app-state kind="empty" title="Aún no hay deportistas"
            [text]="isPhysio ? 'Los deportistas aparecerán aquí cuando se registren.' : 'Cuando administración te asigne deportistas, aparecerán aquí.'" />
        </div>
      } @else {
        <section class="section" aria-labelledby="h-al">
          <div class="section-head">
            <h2 id="h-al">Alertas por revisar</h2>
            @if (store.alerts().length) { <a routerLink="/equipo/alertas">Ver alertas por revisar</a> }
          </div>
          @if (store.alerts().length) {
            <ul class="card list">
              @for (a of top(); track a.id) {
                <li>
                  <div>
                    <strong>{{ a.athleteName }}</strong>
                    <small>{{ a.zone }} · {{ ago(a.createdAt) }}</small>
                    @if (isPhysio) { <a class="action-link" [routerLink]="['/equipo/alertas', a.id]">{{ actions[a.status] }}</a> }
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

        @if (isPhysio) {
          <section class="card section review-enter" aria-labelledby="h-follow">
            <div class="card-head">
              <div>
                <h2 id="h-follow">Próximos seguimientos</h2>
                <p class="meta">Revisiones que requieren volver a contactar o valorar al deportista.</p>
              </div>
              @if (upcoming().length) {
                <a class="btn secondary sm" routerLink="/equipo/alertas" [queryParams]="{status:'FOLLOW_UP_PENDING'}">Ver todos los seguimientos</a>
              }
            </div>
            @if (upcoming().length) {
              <div class="stack">
                @for (group of followUpGroups(); track group.id) {
                  <div class="follow-up-group">
                    <h3 [id]="group.id">{{ group.title }} <small>{{ group.items.length }}</small></h3>
                    <ul class="stack plain follow-up-list review-stack" [attr.aria-labelledby]="group.id">
                      @for (alert of group.items.slice(0, 2); track alert.id) {
                        <li class="follow-up-row" [class.overdue]="group.id === 'overdue'">
                          <div class="follow-up-person">
                            <strong>{{ alert.athleteName }}</strong><span class="meta">{{ alert.zone }}</span>
                          </div>
                          <div class="follow-up-schedule">
                            @if (alert.followUpDate; as date) {
                              <time [attr.datetime]="date.slice(0, 10)">{{ date | date:'dd/MM/yyyy':'UTC' }}</time>
                              <span [class]="'badge ' + (group.id === 'overdue' ? 'mid' : 'low')">
                                {{ group.id === 'overdue' ? 'Vencido' : date.slice(0, 10) === calendarToday() ? 'Para hoy' : 'Programado' }}
                              </span>
                            } @else {
                              <span class="badge low">Pendiente sin fecha</span>
                            }
                          </div>
                          <a class="btn sm" [routerLink]="['/equipo/alertas', alert.id]"
                            [attr.aria-label]="'Registrar seguimiento de ' + alert.athleteName + ', ' + alert.zone">Registrar seguimiento</a>
                        </li>
                      }
                    </ul>
                  </div>
                }
                @if (hasMoreFollowUps()) {
                  <p class="results-line">Se muestran hasta dos por grupo. Consulta la lista completa para ver los demás.</p>
                }
              </div>
            } @else {
              <app-state kind="success" title="Sin seguimientos pendientes"
                text="Si una revisión deja un seguimiento pendiente, aparecerá aquí." />
            }
          </section>
        }

        <section class="section" aria-labelledby="h-at">
          <div class="section-head">
            <h2 id="h-at">Necesitan atención</h2>
            <a routerLink="/equipo/deportistas">Ver deportistas</a>
          </div>
          @if (store.attention().length) {
            <ul class="ath-list">
              @for (a of store.attention().slice(0, 5); track a.id) {
                <li><app-athlete-row [a]="a" /></li>
              }
            </ul>
          } @else {
            <div class="card"><app-state kind="success" title="Sin pendientes en el equipo" text="No hay alertas, seguimientos ni problemas de adherencia en este resumen." /></div>
          }
        </section>
      }
    }
  `,
  styles: [`
    .kpi { align-content: start; }
    .kpi-label, .kpi span { font-size: var(--text-caption); }
  `],
})
export class TeamOverviewPage {
  store = inject(TeamStore);
  private auth = inject(AuthService);

  isPhysio = this.auth.user()?.role === 'PHYSIO';
  calendarToday = signal(bogotaDay());
  today = computed(() => headingDate.format(new Date(this.calendarToday())));
  scope = computed(() =>
    this.auth.user()?.role === 'PHYSIO' ? 'Revisa alertas y seguimientos pendientes y consulta cómo avanza el equipo.' : 'Consulta el avance y las alertas de tus deportistas asignados.'
  );
  hasStarted = computed(() => this.store.athletes().some(athlete => athlete.planned > 0));
  upcoming = computed(() => [...this.store.followUps()].sort((a, b) => (a.followUpDate ?? '9999').localeCompare(b.followUpDate ?? '9999')));
  followUpGroups = computed(() => {
    const today = this.calendarToday();
    const dated = this.upcoming().filter(alert => alert.followUpDate);
    return [
      { id: 'overdue', title: 'Vencidos', items: dated.filter(alert => alert.followUpDate!.slice(0, 10) < today) },
      { id: 'scheduled', title: 'Con fecha próxima', items: dated.filter(alert => alert.followUpDate!.slice(0, 10) >= today) },
      { id: 'undated', title: 'Sin fecha programada', items: this.upcoming().filter(alert => !alert.followUpDate) }
    ].filter(group => group.items.length);
  });
  hasMoreFollowUps = computed(() => this.followUpGroups().some(group => group.items.length > 2));
  actions = ALERT_ACTION;
  top = computed(() => this.store.alerts().slice(0, 3));

  constructor() {
    const minute = 60_000;
    timer(minute - Date.now() % minute, minute).pipe(takeUntilDestroyed()).subscribe(() => {
      this.calendarToday.set(bogotaDay());
    });
  }

  level = painLevel;
  label(n: number) { return PAIN_LABEL[painLevel(n)]; }
  ago = ago;
}
