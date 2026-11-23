import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormRecord, ReactiveFormsModule, Validators } from '@angular/forms';
import { apiError } from '../core/auth.service';
import { ZONES } from '../core/athlete-store';
import { StateView } from '../core/state';
import { bogotaDay, formatHistoryDay } from '../core/civil-date';

type Value = string | number | boolean | null;
type Field = { key: string; label: string; type?: 'date' | 'number'; max?: number; options?: Record<string, string> };
type Revision = { version: number; authorName: string; recordedAt: string; details: Record<string, Value> };

@Component({
  selector: 'app-injury-characterization',
  imports: [ReactiveFormsModule, StateView],
  templateUrl: './injury-characterization.html',
  styleUrl: './injury-characterization.scss',
})
export class InjuryCharacterization {
  athleteId = input.required<string>();
  injuryId = input.required<string>();
  private http = inject(HttpClient);
  private destroy = inject(DestroyRef);
  private operation?: { key: string; id: string };
  opened = signal(false);
  loading = signal(false);
  loaded = signal(false);
  saving = signal(false);
  editing = signal(false);
  error = signal('');
  unavailable = signal(false);
  revisions = signal<Revision[]>([]);
  today = bogotaDay;
  revisionDay(value: string) { return formatHistoryDay(bogotaDay(new Date(value))); }
  sections: { label: string; fields: Field[] }[] = [
    { label: 'Localización y fecha', fields: [
      { key: 'zone', label: 'Región anatómica', options: Object.fromEntries(ZONES.map(zone => [zone, zone])) },
      { key: 'side', label: 'Lateralidad', options: { LEFT: 'Izquierda', RIGHT: 'Derecha', BILATERAL: 'Bilateral', NOT_APPLICABLE: 'No aplica' } },
      { key: 'eventOn', label: 'Fecha exacta', type: 'date' },
      { key: 'approximateSince', label: 'Periodo aproximado desde', type: 'date' },
      { key: 'approximateUntil', label: 'Periodo aproximado hasta', type: 'date' },
      { key: 'recurrent', label: 'Recurrencia', options: { yes: 'Sí', no: 'No' } },
    ] },
    { label: 'Evento y consecuencias', fields: [
      { key: 'context', label: 'Contexto', options: { TRAINING: 'Entrenamiento', COMPETITION: 'Competencia', OTHER: 'Otro' } },
      { key: 'activity', label: 'Actividad deportiva', max: 120 },
      { key: 'mechanism', label: 'Mecanismo reportado', max: 250 },
      { key: 'consequence', label: 'Consecuencia funcional', max: 500 },
      { key: 'daysAbsent', label: 'Días de ausencia', type: 'number' },
    ] },
    { label: 'Clasificación y seguimiento profesional', fields: [
      { key: 'source', label: 'Fuente', options: { ATHLETE: 'Relato del deportista', PROFESSIONAL: 'Valoración profesional', DOCUMENT: 'Documento clínico' } },
      { key: 'classification', label: 'Clasificación documentada', max: 120 },
      { key: 'treatment', label: 'Tratamiento o seguimiento', max: 500 },
      { key: 'prevention', label: 'Prácticas preventivas realizadas', max: 500 },
      { key: 'caseStatus', label: 'Estado del caso', options: { OPEN: 'Abierto', FOLLOW_UP: 'En seguimiento', RESOLVED: 'Resuelto' } },
      { key: 'reason', label: 'Motivo de corrección', max: 500 },
    ] },
  ];
  fields = this.sections.flatMap(section => section.fields);
  form = new FormRecord<FormControl<Value>>(Object.fromEntries(this.fields.map(field => [
    field.key, new FormControl<Value>(null, field.type === 'number' ? [Validators.min(0), Validators.max(3650)] : []),
  ])));

  private endpoint() { return `/api/team/athletes/${this.athleteId()}/injuries/${this.injuryId()}/characterization`; }
  options(field: Field) { return Object.entries(field.options ?? {}); }

  toggle() {
    this.opened.update(value => !value);
    if (this.opened() && !this.loaded() && !this.loading() && !this.unavailable()) this.load();
  }

  load() {
    this.error.set('');
    this.loading.set(true);
    this.http.get<Revision[]>(this.endpoint()).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: rows => { this.revisions.set(rows); this.loaded.set(true); this.loading.set(false); },
      error: error => { this.setError(error); this.loading.set(false); },
    });
  }

  private setError(error: unknown) {
    if (error instanceof HttpErrorResponse && [401, 403, 404].includes(error.status)) {
      this.revisions.set([]);
      this.loaded.set(false);
      this.editing.set(false);
      this.form.reset();
      this.unavailable.set(true);
      return;
    }
    this.error.set(apiError(error));
  }

  start() {
    const latest = this.revisions()[0]?.details;
    this.form.reset(Object.fromEntries(this.fields.map(({ key }) => {
      const value = key === 'reason' ? null : latest?.[key] ?? null;
      return [key, typeof value === 'boolean' ? (value ? 'yes' : 'no') : value];
    })));
    this.operation = undefined;
    this.error.set('');
    this.editing.set(true);
  }

  save() {
    if (this.saving() || this.form.invalid) return;
    const expectedVersion = this.revisions()[0]?.version ?? 0;
    const normalized = Object.entries(this.form.getRawValue()).map(([key, raw]) => {
      const value = typeof raw === 'string' ? raw.trim() || null : raw;
      return [key, key === 'recurrent' && value !== null ? value === 'yes' : value];
    });
    const details = Object.fromEntries(normalized);
    if (expectedVersion && !details.reason) {
      this.error.set('Indica el motivo de la corrección.');
      return;
    }
    const key = JSON.stringify({ expectedVersion, details });
    if (this.operation?.key !== key) this.operation = { key, id: crypto.randomUUID() };
    this.saving.set(true);
    this.error.set('');
    this.http.put(this.endpoint(), { expectedVersion, details, operationId: this.operation.id })
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: () => { this.saving.set(false); this.editing.set(false); this.load(); },
        error: error => { this.saving.set(false); this.setError(error); },
      });
  }

  describe(field: Field, value: Value) {
    if (value === null) return 'Sin dato';
    const key = typeof value === 'boolean' ? value ? 'yes' : 'no' : String(value);
    return field.options?.[key] ?? key;
  }
}
