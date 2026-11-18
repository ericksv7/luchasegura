import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ALERT_LABEL, AlertEntry } from '../core/alert-api';

@Component({
  selector: 'app-review-history',
  imports: [DatePipe],
  template: `
    @if (!entries().length) {
      <p class="meta">No hay revisiones documentadas para esta alerta.</p>
    } @else {
      <ul class="stack plain review-stack">
        @for (entry of entries(); track entry.id) {
          <li class="card history-entry">
            <h3 class="lbl">{{ entry.kind === 'REVIEW' ? (entry.previousStatus === 'FOLLOW_UP_PENDING' ? (entry.status === 'REVIEWED' ? 'Seguimiento finalizado' : 'Seguimiento registrado') : 'Revisión registrada') : entry.kind === 'REOPEN' ? 'Reapertura' : entry.previousStatus === 'FOLLOW_UP_PENDING' ? 'Inicio de seguimiento' : 'Inicio de revisión' }}</h3>
            <div class="history-meta">
              <p class="meta">{{ entry.authorName }} · <time [attr.datetime]="entry.createdAt">{{ entry.createdAt | date:'dd/MM/yyyy HH:mm' }}</time></p>
              <span class="badge low">{{ label[entry.status] }}</span>
            </div>
            <p class="meta">Estado anterior · {{ label[entry.previousStatus] }}</p>
            <p class="dlg-desc"><strong>{{ entry.kind === 'REVIEW' ? 'Observaciones' : 'Motivo / actuación de registro' }}:</strong> {{ entry.observations }}</p>
            @if (entry.findings) { <p class="dlg-desc"><strong>Hallazgos:</strong> {{ entry.findings }}</p> }
            @if (entry.actionTaken) { <p class="dlg-desc"><strong>Actuación realizada:</strong> {{ entry.actionTaken }}</p> }
            @if (entry.recommendations) { <p class="dlg-desc"><strong>Recomendaciones:</strong> {{ entry.recommendations }}</p> }
            @if (entry.referral) { <p class="dlg-desc"><strong>Remisión:</strong> {{ entry.referral }}</p> }
            @if (entry.kind === 'REVIEW') {
              <p class="meta">{{ entry.followUpRequired ? 'Se indicó seguimiento' : entry.previousStatus === 'FOLLOW_UP_PENDING' ? 'Seguimiento finalizado; no implica recuperación clínica' : 'No se indicó seguimiento en esta revisión' }}@if (entry.followUpDate) { · {{ entry.followUpDate | date:'dd/MM/yyyy':'UTC' }} }</p>
            }
          </li>
        }
      </ul>
    }
  `
})
export class ReviewHistory {
  entries = input.required<AlertEntry[]>();
  label = ALERT_LABEL;
}
