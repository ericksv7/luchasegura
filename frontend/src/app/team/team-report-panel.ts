import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ALERT_LABEL } from '../core/alert-api';
import { apiError } from '../core/auth.service';
import { TeamAthlete } from '../core/team-store';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const REPORTS = [
  ['all', 'Consolidado'], ['athletes', 'Deportistas'], ['injuries', 'Molestias y antecedentes'],
  ['alerts', 'Alertas y seguimientos'], ['program', 'Programa preventivo'], ['assignments', 'Ejercicios asignados']
] as const;
type Report = typeof REPORTS[number][0];

@Component({
  selector: 'app-team-report-panel',
  styles: [`
    details { container-type: inline-size; }
    .report-fields, .report-dates { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
    .report-form { margin-top: 12px; }
    .report-fields .field { align-content: start; }
    .report-fields .hint { overflow-wrap: anywhere; }
    .report-period { border-top: 1px solid var(--line); padding-top: 12px; }
    .report-period legend { float: left; width: 100%; }
    .report-dates { clear: both; max-inline-size: 36rem; }
    .report-period p { margin: 8px 0 0; }
    @container (min-width: 420px) {
      .report-fields, .report-dates { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .report-fields .field { grid-row: span 3; grid-template-rows: subgrid; }
    }
    @container (min-width: 600px) {
      .report-fields { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    }
    .report-submit { justify-self: start; }
  `],
  template: `
    <details class="disclosure card section">
      <summary>Exportar reporte a Excel</summary>
      <form class="form report-form" (submit)="download($event)" novalidate>
        <p class="meta">Selecciona el reporte, el alcance y el nivel de identificación.</p>
        <fieldset class="group report-fields" [disabled]="busy()" aria-label="Selección y alcance">
          <div class="field">
            <label for="export-report">Reporte</label>
            <select id="export-report" [value]="report()" aria-describedby="export-report-hint" (change)="chooseReport($any($event.target).value)">
              @for (option of reports; track option[0]) {
                <option [value]="option[0]">{{ option[1] }}</option>
              }
            </select>
            <small class="hint" id="export-report-hint">{{ reportLabel() }}</small>
          </div>
          <div class="field">
            <label for="export-athlete">Deportista</label>
            <select id="export-athlete" [value]="athleteId()" aria-describedby="export-athlete-hint" (change)="athleteId.set($any($event.target).value)">
              <option value="">Todos los autorizados</option>
              @for (athlete of athletes(); track athlete.id) {
                <option [value]="athlete.id">{{ athlete.name }} · {{ athlete.email }}</option>
              }
            </select>
            <small class="hint" id="export-athlete-hint">{{ selectedAthlete() || 'Incluye a todos los deportistas autorizados.' }}</small>
          </div>
          <div class="field">
            <label for="export-privacy">Identificación del reporte</label>
            <select id="export-privacy" [value]="privacy()" (change)="privacy.set($any($event.target).value)" aria-describedby="export-privacy-hint">
              <option value="coded">Seudonimizado</option>
              <option value="identified">Identificable</option>
            </select>
            <small class="hint" id="export-privacy-hint">{{ privacy() === 'coded'
              ? 'Usa códigos por archivo. Las fechas y combinaciones de datos aún pueden permitir la reidentificación.'
              : 'Incluye nombres y notas autorizadas. Utilízalo solo dentro del seguimiento profesional.' }}</small>
          </div>
          @if (hasAlertFilter()) {
            <div class="field">
              <label for="export-status">Estado actual de la alerta</label>
              <select id="export-status" [value]="status()" aria-describedby="export-status-hint" (change)="status.set($any($event.target).value)">
                <option value="ALL">Todos los estados</option>
                <option value="PENDING">Pendientes (todas)</option>
                @for (option of statuses; track option[0]) {
                  <option [value]="option[0]">{{ option[1] }}</option>
                }
              </select>
              <small class="hint" id="export-status-hint">{{ statusLabel() }}</small>
            </div>
          }
        </fieldset>
        @if (report() !== 'athletes') {
          <fieldset class="group report-period" [disabled]="busy()">
            <legend>Periodo de actividad</legend>
            <div class="report-dates">
            <div class="field">
              <label for="export-from">Desde <span class="opt">(opcional)</span></label>
              <input id="export-from" type="date" min="1900-01-01" max="9999-12-30" [value]="from()"
                [attr.aria-invalid]="periodError() ? 'true' : null" aria-describedby="export-period"
                (input)="from.set($any($event.target).value)" />
            </div>
            <div class="field">
              <label for="export-to">Hasta <span class="opt">(opcional)</span></label>
              <input id="export-to" type="date" min="1900-01-01" max="9999-12-30" [value]="to()"
                [attr.aria-invalid]="periodError() ? 'true' : null" aria-describedby="export-period"
                (input)="to.set($any($event.target).value)" />
            </div>
            </div>
          <p id="export-period" [class.msg]="periodError()" class="meta">
            {{ periodError() || 'El periodo de actividad incluye ambos días y usa la hora de Bogotá. El avance del programa se calcula al día de la descarga.' }}
          </p>
          </fieldset>
        }
        <button type="submit" class="btn report-submit" [disabled]="busy() || !!periodError()" [attr.aria-busy]="busy()">
          {{ busy() ? 'Generando Excel…' : 'Descargar Excel' }}
        </button>
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <p class="meta" role="status">{{ feedback() }}</p>
      </form>
    </details>
  `
})
export class TeamReportPanel {
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);
  athletes = input.required<TeamAthlete[]>();
  reports = REPORTS;
  statuses = Object.entries(ALERT_LABEL);
  report = signal<Report>('all');
  athleteId = signal('');
  privacy = signal('coded');
  status = signal('ALL');
  from = signal('');
  to = signal('');
  busy = signal(false);
  error = signal('');
  feedback = signal('');
  selectedAthlete = computed(() => {
    const athlete = this.athletes().find(a => a.id === this.athleteId());
    return athlete ? `${athlete.name} · ${athlete.email}` : '';
  });
  reportLabel = computed(() => REPORTS.find(option => option[0] === this.report())?.[1] ?? '');
  statusLabel = computed(() => this.status() === 'PENDING' ? 'Nuevas y en revisión.' :
    this.status() === 'ALL' ? 'Incluye todos los estados.' : this.statuses.find(option => option[0] === this.status())?.[1] ?? '');
  hasAlertFilter = computed(() => this.report() === 'all' || this.report() === 'alerts');
  periodError = computed(() => {
    const from = this.from();
    const to = this.to();
    const invalid = [from, to].some(day => day && (!/^\d{4}-\d\d-\d\d$/.test(day) || day < '1900-01-01' || day > '9999-12-30'));
    if (invalid) return 'Indica una fecha válida.';
    return from && to && from > to ? 'La fecha inicial debe ser anterior o igual a la final.' : '';
  });

  chooseReport(report: Report) {
    this.report.set(report);
    if (!this.hasAlertFilter()) this.status.set('ALL');
    if (report === 'athletes') {
      this.from.set('');
      this.to.set('');
    }
  }

  download(event: Event) {
    event.preventDefault();
    if (this.busy() || this.periodError()) return;
    this.error.set('');
    this.feedback.set('');
    this.busy.set(true);
    let params = new HttpParams().set('report', this.report()).set('privacy', this.privacy());
    for (const [key, value] of Object.entries({ athleteId: this.athleteId(), from: this.from(), to: this.to() })) {
      if (value) params = params.set(key, value);
    }
    if (this.hasAlertFilter()) params = params.set('status', this.status());

    this.http.get('/api/team/export', { params, responseType: 'blob', observe: 'response' })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false)))
      .subscribe({
        next: response => {
          const file = response.body;
          if (file?.type !== XLSX || !file.size) {
            this.error.set('La respuesta no contiene un archivo Excel válido.');
            return;
          }
          const filename = response.headers.get('Content-Disposition')?.match(/filename="([\w.-]+\.xlsx)"/)?.[1];
          const url = URL.createObjectURL(file);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename ?? 'luchasegura_reporte.xlsx';
          document.body.append(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 30000);
          this.feedback.set('Excel generado. Revisa las descargas del navegador.');
        },
        error: (error: HttpErrorResponse) => {
          if (!(error.error instanceof Blob)) {
            this.error.set(apiError(error));
            return;
          }
          void error.error.text().then(body => {
            const data = JSON.parse(body) as { error?: unknown };
            this.error.set(typeof data.error === 'string' ? data.error : 'No pudimos generar el reporte.');
          }).catch(() => this.error.set('No pudimos generar el reporte.'));
        },
      });
  }
}
