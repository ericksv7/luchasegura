import { formatHistoryDay } from '../core/civil-date';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ALERT_LABEL, AlertApi, AlertDetail, ReviewPayload } from '../core/alert-api';
import { apiError } from '../core/auth.service';
import { LIMIT_LABEL } from '../core/athlete-store';
import { StateView } from '../core/state';
import { TeamStore } from '../core/team-store';
import { ToastService } from '../core/toast.service';
import { ReviewHistory } from './review-history';

@Component({
  selector: 'app-alert-review',
  imports: [DatePipe, RouterLink, ReactiveFormsModule, StateView, ReviewHistory],
  template: `
    @if (fromAthleteReviews() && detail(); as current) {
      <a class="back" [routerLink]="['/equipo/deportistas', current.athlete.id]" [queryParams]="{ tab: 'reviews' }">Volver a revisiones de la ficha</a>
    } @else {
      <a class="back" routerLink="/equipo/alertas">Volver a alertas</a>
    }
    @if (loading()) {
      <div class="review-skeleton" role="status" aria-busy="true" aria-label="Cargando revisión de alerta">
        <div aria-hidden="true">
          <header class="page-head"><h1 class="sk">Revisión de alerta</h1><p class="sub sk">Información del deportista</p><span class="sk">Estado de la alerta</span></header>
          <div class="sk sk-input section-sm"></div>
          <div class="stack review-workspace">
            <div class="stack review-context">
            <section class="card">
              <h2 class="sk">Reporte del deportista</h2>
              <dl class="rows">@for (row of skeletonRows; track row) { <div><dt class="sk">Información</dt><dd class="sk">Datos del reporte</dd></div> }</dl>
            </section>
            <section class="card"><h2 class="sk">Antecedentes y molestias</h2><div class="sk sk-row"></div></section>
            </div>
            <section class="card form review-editor">
              <h2 class="sk">Registrar revisión</h2>
              @for (field of skeletonFields; track field) { <div class="field"><span class="sk">Campo de la revisión</span><div class="sk sk-textarea"></div></div> }
              <div class="sk sk-row"></div><div class="sk sk-input"></div>
            </section>
            <section class="card review-timeline"><h2 class="sk">Historial de esta alerta</h2><div class="stack"><div class="sk sk-row"></div><div class="sk sk-row"></div></div></section>
          </div>
        </div>
      </div>
    } @else if (notFound()) {
      <app-state kind="empty" title="Alerta no disponible" text="No encontramos información para esta alerta." />
    } @else if (failed()) {
      <app-state kind="error" title="No pudimos cargar la revisión" [text]="error()" action="Reintentar" (act)="load()" />
    } @else if (detail(); as d) {
      <header class="page-head review-enter">
        <h1>{{ d.alert.status === 'FOLLOW_UP_PENDING' ? 'Seguimiento de alerta' : 'Revisión de alerta' }}</h1>
        <p class="sub"><a class="action-link" [routerLink]="['/equipo/deportistas', d.athlete.id]">{{ d.athlete.name }}</a></p>
        <span class="badge" [class.mid]="d.alert.status !== 'REVIEWED'" [class.low]="d.alert.status === 'REVIEWED'">{{ label[d.alert.status] }}</span>
      </header>
      <p class="notice">Registrar una revisión no significa que la molestia esté resuelta clínicamente. Las notas profesionales son de acceso reservado al fisioterapeuta.</p>
      <div class="stack review-stack review-workspace">
        <div class="stack review-context">
        <section class="card" aria-labelledby="review-report">
          <h2 id="review-report">Reporte del deportista</h2>
          <dl class="rows">
            <div><dt>Fecha reportada</dt><dd>{{ d.report.occurredAt | date:'dd/MM/yyyy HH:mm' }}</dd></div>
            <div><dt>Fecha de registro</dt><dd>{{ d.report.createdAt | date:'dd/MM/yyyy HH:mm' }}</dd></div>
            <div><dt>Zona afectada</dt><dd>{{ d.report.bodyZone }}</dd></div>
            <div><dt>Intensidad</dt><dd>{{ d.report.intensity !== null ? d.report.intensity + '/10' : 'No registrada' }}</dd></div>
            @if (d.report.whenOccurs) { <div><dt>Momento de aparición</dt><dd>{{ d.report.whenOccurs }}</dd></div> }
            @if (d.report.mechanism) { <div><dt>Mecanismo reportado</dt><dd>{{ d.report.mechanism }}</dd></div> }
            <div><dt>Limitación</dt><dd>{{ limits[d.report.limitation] }}</dd></div>
            @if (d.report.injuryType) { <div><dt>Tipo indicado en el reporte</dt><dd>{{ d.report.injuryType }}</dd></div> }
            @if (d.report.daysAbsent !== null) { <div><dt>Días sin entrenar</dt><dd>{{ d.report.daysAbsent }}</dd></div> }
          </dl>
          @if (d.report.notes) { <p class="dlg-desc"><strong>Notas del deportista:</strong> {{ d.report.notes }}</p> }
        </section>
        <details class="disclosure card" aria-labelledby="review-history">
          <summary id="review-history">Antecedentes, molestias y revisiones del deportista</summary>
          @if (!d.history.length) { <p class="meta">No hay otros registros almacenados.</p> }
          @for (item of d.history; track item.id) {
            <details class="disclosure section-sm">
              <summary>{{ item.isHistory ? 'Antecedente' : 'Molestia' }} · {{ item.bodyZone }}{{ item.bodyZone === d.report.bodyZone ? ' · Misma zona' : '' }} · {{ item.isHistory ? formatHistoryDay(item.historyDate) : (item.occurredAt | date:'dd/MM/yyyy') }}</summary>
              @if (item.injuryType) { <p class="meta">{{ item.injuryType }}</p> }
              @if (item.recurrent) { <span class="badge mid">Recurrente</span> }
              @if (item.intensity !== null) { <p class="meta">Intensidad: {{ item.intensity }}/10</p> }
              <p class="meta">{{ limits[item.limitation] }}</p>
              @if (item.notes) { <p class="dlg-desc">{{ item.notes }}</p> }
              @for (alert of item.alerts; track alert.id) {
                <a class="action-link" [routerLink]="['/equipo/alertas', alert.id]">Consultar alerta · {{ label[alert.status] }}</a>
                <app-review-history [entries]="alert.entries" />
              }
            </details>
          }
        </details>
        </div>

        <section class="card review-editor" aria-labelledby="review-form-title">
          @if (d.alert.status === 'REVIEWED') {
            <h2 id="review-form-title">Revisión registrada</h2>
            <p class="meta">Consulta el historial documentado. Para añadir una nueva revisión, reabre la alerta con una justificación.</p>
            @if (!d.alert.entries.length) { <p class="notice">Esta alerta fue marcada como revisada en el sistema anterior y no tiene revisión documentada.</p> }
            <details class="disclosure section-sm">
              <summary>Reabrir alerta</summary>
            <div class="form section-sm review-enter">
              <div class="field">
                <label for="reopen-reason">Motivo de reapertura</label>
                <textarea id="reopen-reason" rows="3" maxlength="4000" [formControl]="reopenReason" [attr.aria-invalid]="reopenReason.touched && reopenReason.invalid ? 'true' : null"></textarea>
                @if (reopenReason.touched && reopenReason.invalid) { <small class="msg" role="alert">Escribe el motivo de reapertura.</small> }
              </div>
              <button type="button" class="btn secondary" [disabled]="saving()" (click)="send('REOPEN')">Reabrir alerta</button>
            </div>
            </details>
          } @else {
            <h2 id="review-form-title">{{ d.alert.status === 'FOLLOW_UP_PENDING' ? 'Registrar seguimiento' : 'Registrar revisión' }}</h2>
            @if (d.alert.status !== 'IN_REVIEW' && d.alert.entries.at(-1)?.kind !== 'START') {
              <button type="button" class="btn secondary sm" [disabled]="saving()" (click)="send('START')">{{ d.alert.status === 'FOLLOW_UP_PENDING' ? 'Iniciar seguimiento' : 'Iniciar revisión' }}</button>
            }
            <form class="form review-edit-form" [formGroup]="form" (ngSubmit)="send('REVIEW')" novalidate>
              <fieldset class="group form" [disabled]="saving()">
              <div class="field">
                <label for="rv-observations">Observaciones del profesional *</label>
                <textarea id="rv-observations" rows="3" maxlength="4000" formControlName="observations" [attr.aria-describedby]="bad('observations') ? 'rv-observations-error' : null" [attr.aria-invalid]="bad('observations') ? 'true' : null"></textarea>
                @if (bad('observations')) { <small class="msg" role="alert" id="rv-observations-error">Registra las observaciones (mínimo 2 caracteres).</small> }
              </div>
              <div class="field">
                <label for="rv-action">Actuación realizada *</label>
                <textarea id="rv-action" rows="3" maxlength="4000" formControlName="actionTaken" [attr.aria-describedby]="bad('actionTaken') ? 'rv-action-error' : null" [attr.aria-invalid]="bad('actionTaken') ? 'true' : null"></textarea>
                @if (bad('actionTaken')) { <small class="msg" role="alert" id="rv-action-error">Describe la actuación realizada (mínimo 2 caracteres).</small> }
              </div>
              <details class="disclosure review-options"><summary>Hallazgos, recomendaciones y remisión (opcionales)</summary>
                <div class="form review-option-fields">
              <div class="field"><label for="rv-findings">Hallazgos de la valoración <span class="opt">(opcional)</span></label><textarea id="rv-findings" rows="3" maxlength="4000" formControlName="findings"></textarea></div>
              <div class="field"><label for="rv-recommendations">Recomendaciones o indicaciones <span class="opt">(opcional)</span></label><textarea id="rv-recommendations" rows="3" maxlength="4000" formControlName="recommendations"></textarea></div>
              <div class="field"><label for="rv-referral">Remisión a otro profesional <span class="opt">(opcional)</span></label><textarea id="rv-referral" rows="2" maxlength="4000" formControlName="referral"></textarea></div>
                </div>
              </details>
              @if (d.alert.status === 'FOLLOW_UP_PENDING') {
                <div class="field">
                  <label for="rv-followup-action">Acción de seguimiento</label>
                  <select id="rv-followup-action" formControlName="followUpRequired">
                    <option [ngValue]="true">Registrar seguimiento y mantenerlo pendiente</option>
                    <option [ngValue]="false">Finalizar seguimiento</option>
                  </select>
                  <small class="hint">Ya existe una revisión anterior. La finalización registra esta actuación y cierra el seguimiento; no declara recuperación clínica.</small>
                </div>
              } @else {
                <label class="check"><input type="checkbox" formControlName="followUpRequired" /><span>Necesita seguimiento</span></label>
              }
              @if (form.controls.followUpRequired.value) {
                <div class="field"><label for="rv-date">Fecha sugerida de seguimiento <span class="opt">(opcional)</span></label><input id="rv-date" type="date" formControlName="followUpDate" /></div>
              }
              <button class="btn" [disabled]="saving()" [attr.aria-busy]="saving()">{{ saving() ? 'Guardando…' : d.alert.status === 'FOLLOW_UP_PENDING' ? (form.controls.followUpRequired.value ? 'Guardar seguimiento' : 'Finalizar seguimiento') : 'Guardar revisión' }}</button>
              <p class="note">* Observaciones y actuación son obligatorias. No se requiere un diagnóstico para registrar la revisión.</p>
              </fieldset>
            </form>
          }
          <p class="meta review-feedback" role="status" aria-live="polite">{{ savedMessage() }}</p>
          @if (refreshing()) { <p class="hint" role="status">Actualizando información…</p> }
          @if (error()) { <p class="error section-sm" role="alert">{{ error() }}</p><button type="button" class="btn secondary sm" [disabled]="saving()" (click)="load()">Actualizar estado de la alerta</button> }
        </section>

        <section class="card review-timeline" aria-labelledby="review-timeline"><h2 id="review-timeline">Historial de esta alerta</h2><app-review-history [entries]="d.alert.entries" /></section>

      </div>
    }
  `
})
export class AlertReviewPage {
  protected readonly formatHistoryDay = formatHistoryDay;
  private api = inject(AlertApi);
  private route = inject(ActivatedRoute);
  private fb = inject(NonNullableFormBuilder);
  private store = inject(TeamStore);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);
  private request?: { unsubscribe(): void };
  private mutation?: { unsubscribe(): void };
  private attempt: { fingerprint: string; key: string } | null = null;
  detail = signal<AlertDetail | null>(null);
  loading = signal(true);
  failed = signal(false);
  notFound = signal(false);
  refreshing = signal(false);
  savedMessage = signal('');
  skeletonRows = [1, 2, 3, 4, 5, 6];
  skeletonFields = [1, 2];
  saving = signal(false);
  error = signal('');
  label = ALERT_LABEL;
  limits = LIMIT_LABEL;
  form = this.fb.group({
    observations: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(4000)]],
    findings: [''], actionTaken: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(4000)]],
    recommendations: [''], referral: [''], followUpRequired: [false], followUpDate: ['']
  });
  reopenReason = this.fb.control('', [Validators.required, Validators.minLength(2), Validators.maxLength(4000)]);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(() => {
      this.mutation?.unsubscribe(); this.saving.set(false); this.savedMessage.set('');
      this.detail.set(null); this.form.reset(); this.reopenReason.reset(); this.attempt = null;
      this.load();
    });
  }
  load() {
    this.request?.unsubscribe();
    this.loading.set(this.detail() === null); this.refreshing.set(this.detail() !== null);
    this.failed.set(false); this.notFound.set(false); this.error.set('');
    this.request = this.api.detail(this.route.snapshot.paramMap.get('id')!).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => {
        if (!this.detail() && d.alert.status === 'FOLLOW_UP_PENDING') this.form.controls.followUpRequired.setValue(true);
        this.detail.update((current) => current && current.alert.id === d.alert.id && current.alert.version > d.alert.version ? current : d);
        this.loading.set(false); this.refreshing.set(false);
      },
      error: (e) => {
        this.error.set(this.detail() ? 'Se conserva la información mostrada. No se pudo actualizar: ' + apiError(e) : apiError(e));
        this.notFound.set(!this.detail() && e.status === 404);
        this.failed.set(!this.detail() && e.status !== 404);
        this.loading.set(false); this.refreshing.set(false);
      }
    });
  }
  fromAthleteReviews() { return this.route.snapshot.queryParamMap.get('from') === 'athlete-reviews'; }

  bad(name: 'observations' | 'actionTaken') {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }
  send(kind: ReviewPayload['kind']) {
    const d = this.detail();
    if (!d || this.saving()) return;
    let payload: ReviewPayload;
    if (kind === 'REVIEW') {
      if (this.form.invalid) { this.form.markAllAsTouched(); return; }
      const value = this.form.getRawValue();
      payload = { ...value, kind, followUpDate: value.followUpRequired ? value.followUpDate || null : null };
    } else if (kind === 'REOPEN') {
      if (this.reopenReason.invalid) { this.reopenReason.markAsTouched(); return; }
      payload = { kind, observations: this.reopenReason.value };
    } else payload = { kind };
    const body = { ...payload, expectedVersion: d.alert.version };
    const fingerprint = JSON.stringify({ alertId: d.alert.id, ...body });
    if (this.attempt?.fingerprint !== fingerprint) this.attempt = { fingerprint, key: crypto.randomUUID() };
    this.saving.set(true); this.error.set(''); this.savedMessage.set('');
    this.mutation = this.api.record(d.alert.id, { ...body, requestId: this.attempt!.key }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (entry) => {
        this.request?.unsubscribe();
        this.store.recorded(d, entry);
        this.detail.update((current) => current && current.alert.id === d.alert.id && entry.version >= current.alert.version ? {
          ...current, alert: { ...current.alert, status: entry.status, version: entry.version,
            entries: [...current.alert.entries.filter((e) => e.id !== entry.id), entry].sort((a, b) => a.version - b.version) }
        } : current);
        this.saving.set(false);
        this.attempt = null;
        if (kind === 'REVIEW') this.form.reset({ followUpRequired: entry.status === 'FOLLOW_UP_PENDING' });
        this.reopenReason.reset();
        const message = kind === 'REVIEW' ? (d.alert.status === 'FOLLOW_UP_PENDING' ? (entry.status === 'REVIEWED' ? 'Seguimiento finalizado' : 'Seguimiento registrado') : 'Revisión guardada') : kind === 'REOPEN' ? 'Revisión reabierta' : d.alert.status === 'FOLLOW_UP_PENDING' ? 'Seguimiento iniciado' : 'Revisión iniciada';
        this.savedMessage.set(message + '. ' + this.label[entry.status] + '.');
        this.toast.success(message);
        this.store.load(); this.load();
      },
      error: (e) => { this.error.set(apiError(e)); this.saving.set(false); }
    });
  }
}
