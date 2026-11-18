import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { ALERT_ACTION, ALERT_LABEL, AlertApi, AlertDetail, isPendingReview, ReviewAlert } from '../core/alert-api';
import { StateView } from '../core/state';
import { ReviewHistory } from './review-history';

@Component({
  selector: 'app-athlete-reviews', imports: [DatePipe, RouterLink, StateView, ReviewHistory],
  template: `
    <section class="review-enter stack" aria-labelledby="athlete-reviews-title">
      <header class="card">
      <div class="card-head"><div><h2 id="athlete-reviews-title">Revisiones y seguimientos</h2>
        <p class="meta">Consulta qué reportes requieren una actuación y qué se registró en revisiones previas.</p></div>
        <a class="btn secondary sm" routerLink="/equipo/alertas" [queryParams]="{athleteId: athleteId(), status: 'ALL'}">Filtrar alertas del deportista</a>
      </div>
      </header>
      @if (loading()) { <div class="stack" aria-busy="true" aria-label="Cargando revisiones"><div class="sk sk-row"></div><div class="sk sk-card"></div></div> }
      @else if (failed()) { <app-state kind="error" title="No pudimos cargar las revisiones" action="Reintentar" (act)="load()" /> }
      @else if (!alerts().length) { <div class="card"><app-state kind="empty" title="Sin alertas registradas" text="Cuando un reporte genere una alerta, podrás revisarla y consultar su historial aquí." /></div> }
      @else {
        @for (group of groups(); track group.title) {
        @if (group.items.length) {
        <section [attr.aria-labelledby]="group.id">
          <div class="section-head"><h3 [id]="group.id">{{ group.title }}</h3></div>
          <ul class="stack plain review-stack">
          @for (alert of group.items; track alert.id) {
            <li class="card">
              <div class="card-head"><h4>{{ alert.zone }}</h4><span class="chip">{{ label[alert.status] }}</span></div>
              <p class="meta">Reporte del {{ alert.occurredAt | date:'dd/MM/yyyy' }}@if(alert.intensity !== null) { · Dolor {{ alert.intensity }}/10 }</p>
              @if (alert.status === 'FOLLOW_UP_PENDING') {
                <p class="meta">{{ alert.followUpDate ? 'Seguimiento previsto · ' + (alert.followUpDate | date:'dd/MM/yyyy':'UTC') : 'Seguimiento sin fecha sugerida' }}</p>
              }
              <div class="review-row-actions"><a class="btn sm" [class.secondary]="alert.status === 'REVIEWED'"
                [routerLink]="['/equipo/alertas', alert.id]" [queryParams]="{ from: 'athlete-reviews' }">{{ action[alert.status] }}</a>
                <button class="btn secondary sm" type="button" [attr.aria-expanded]="opened() === alert.id" (click)="toggle(alert.id)">{{ opened() === alert.id ? 'Ocultar historial' : 'Ver historial' }}</button></div>
              @if (opened() === alert.id) {
                @if (detailLoading()) { <div class="sk sk-card" aria-label="Cargando historial" aria-busy="true"></div> }
                @else if (detailFailed()) { <app-state kind="error" title="No pudimos cargar el historial" action="Reintentar" (act)="fetchDetail(alert.id)" /> }
                @else if (detail(); as detail) { <app-review-history [entries]="detail.alert.entries" /> }
              }
            </li>
          }
          </ul>
        </section>
        }
        }
      }
    </section>`
})
export class AthleteReviews {
  athleteId = input.required<string>();
  private api = inject(AlertApi);
  private destroyRef = inject(DestroyRef);
  private listRequest?: Subscription;
  private detailRequest?: Subscription;
  alerts = signal<ReviewAlert[]>([]); loading = signal(true); failed = signal(false);
  opened = signal<string | null>(null); detail = signal<AlertDetail | null>(null);
  detailLoading = signal(false); detailFailed = signal(false);
  groups = computed(() => [
    { id: 'reviews-pending', title: 'Por revisar', items: this.alerts().filter(alert => isPendingReview(alert.status)) },
    { id: 'reviews-follow-up', title: 'Seguimientos pendientes', items: this.alerts().filter(alert => alert.status === 'FOLLOW_UP_PENDING') },
    { id: 'reviews-completed', title: 'Revisiones registradas', items: this.alerts().filter(alert => alert.status === 'REVIEWED') }
  ]);
  label = ALERT_LABEL; action = ALERT_ACTION;
  constructor() { effect(() => { this.athleteId(); this.load(); }); }
  load() {
    this.listRequest?.unsubscribe(); this.detailRequest?.unsubscribe(); this.opened.set(null);
    this.loading.set(true); this.failed.set(false);
    this.listRequest = this.api.list('ALL', this.athleteId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: alerts => { this.alerts.set(alerts); this.loading.set(false); },
      error: () => { this.failed.set(true); this.loading.set(false); }
    });
  }
  toggle(id: string) { if (this.opened() === id) { this.opened.set(null); return; } this.opened.set(id); this.fetchDetail(id); }
  fetchDetail(id: string) {
    this.detailRequest?.unsubscribe(); this.detail.set(null); this.detailLoading.set(true); this.detailFailed.set(false);
    this.detailRequest = this.api.detail(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: detail => { this.detail.set(detail); this.detailLoading.set(false); },
      error: () => { this.detailFailed.set(true); this.detailLoading.set(false); }
    });
  }
}
