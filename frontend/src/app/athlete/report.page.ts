import { Component, inject, signal } from '@angular/core';
import { AthleteStore, LIMITS, LIMIT_LABEL, Limitation, PAIN_LABEL, WHEN, ZONES, fmtDate, painLevel } from '../core/athlete-store';
import { apiError } from '../core/auth.service';
import { StateView } from '../core/state';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-report',
  imports: [StateView],
  template: `
    <header class="page-head">
      <h1>Reportar molestia</h1>
      <p class="sub">Toma menos de un minuto.</p>
    </header>

    <div class="cards">
      <form class="card form-card" (ngSubmit)="submit()" novalidate>
        <fieldset class="group">
          <legend>¿Dónde sientes la molestia?</legend>
          <div class="chips">
            @for (z of zones; track z) {
              <button type="button" class="chip" [class.on]="zone() === z" [attr.aria-pressed]="zone() === z" (click)="zone.set(z)">{{ z }}</button>
            }
          </div>
          @if (submitted() && !zone()) { <small class="msg" role="alert">Elige la zona de la molestia</small> }
        </fieldset>

        <fieldset class="group">
          <legend>Dolor ahora: <strong>{{ pain() === null ? 'sin elegir' : pain() + ' de 10' }}</strong></legend>
          <div class="scale" role="radiogroup" aria-label="Intensidad del dolor de 0 a 10">
            @for (n of scale; track n) {
              <button type="button" role="radio" class="lvl"
                [class.low]="n <= 3" [class.mid]="n > 3 && n <= 6" [class.high]="n > 6" [class.on]="pain() === n"
                [attr.aria-checked]="pain() === n" (click)="pain.set(n)">{{ n }}</button>
            }
          </div>
          <div class="scale-legend" aria-hidden="true"><span>Sin dolor</span><span>Dolor máximo</span></div>
          @if (submitted() && pain() === null) { <small class="msg" role="alert">Elige la intensidad del dolor</small> }
        </fieldset>

        <fieldset class="group">
          <legend>¿Cuándo aparece? <span class="opt">(opcional)</span></legend>
          <div class="chips">
            @for (w of when; track w) {
              <button type="button" class="chip" [class.on]="whenSel() === w" [attr.aria-pressed]="whenSel() === w"
                (click)="whenSel.set(whenSel() === w ? '' : w)">{{ w }}</button>
            }
          </div>
        </fieldset>

        <fieldset class="group">
          <legend>¿Limita tu entrenamiento?</legend>
          <div class="chips">
            @for (l of limits; track l.v) {
              <button type="button" class="chip" [class.on]="limit() === l.v" [attr.aria-pressed]="limit() === l.v"
                (click)="limit.set(l.v)">{{ l.label }}</button>
            }
          </div>
        </fieldset>

        <div class="field">
          <label for="r-notes">Algo más que quieras contar <span class="opt">(opcional)</span></label>
          <textarea id="r-notes" rows="3" [value]="notes()" (input)="notes.set($any($event.target).value)"></textarea>
        </div>

        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <button class="btn" [attr.aria-busy]="saving()" [disabled]="saving()">
          {{ saving() ? 'Enviando…' : 'Enviar reporte' }}
        </button>
        <p class="note">Si tienes un dolor intenso o crees que te lesionaste, busca atención médica. Esta aplicación no reemplaza la valoración profesional.</p>
      </form>

      <section class="card" aria-labelledby="h-rec">
        <h2 id="h-rec">Tus últimos reportes</h2>
        @if (store.failed()) {
          <app-state kind="error" title="No pudimos cargar tus reportes" action="Reintentar" (act)="store.load()" />
        } @else if (store.loading()) {
          <div class="stack" aria-busy="true" aria-label="Cargando">
            <div class="sk sk-row"></div><div class="sk sk-row"></div><div class="sk sk-row"></div>
          </div>
        } @else if (recent().length) {
          <ul class="list">
            @for (r of recent(); track r.id) {
              <li>
                <div>
                  <strong>{{ r.bodyZone }}</strong>
                  <small>{{ date(r.occurredAt) }} · {{ limitLabel(r.limitation) }}</small>
                </div>
                @if (r.intensity !== null) {
                  <span class="badge" [class]="'badge ' + level(r.intensity)">{{ label(r.intensity) }} · {{ r.intensity }}</span>
                }
              </li>
            }
          </ul>
        } @else {
          <app-state kind="empty" title="Sin reportes todavía" text="Tus reportes aparecerán aquí." />
        }
      </section>
    </div>
  `
})
export class ReportPage {
  store = inject(AthleteStore);
  private toast = inject(ToastService);

  zones = ZONES;
  when = WHEN;
  limits = LIMITS;
  scale = Array.from({ length: 11 }, (_, i) => i);

  zone = signal('');
  pain = signal<number | null>(null);
  whenSel = signal('');
  limit = signal<Limitation>('NONE');
  notes = signal('');
  submitted = signal(false);
  saving = signal(false);
  error = signal('');

  recent() { return [...this.store.reports()].reverse().slice(0, 5); }
  level = painLevel;
  label(n: number) { return PAIN_LABEL[painLevel(n)]; }
  limitLabel(l: Limitation) { return LIMIT_LABEL[l]; }
  date = fmtDate;

  submit() {
    this.submitted.set(true);
    const pain = this.pain();
    if (!this.zone() || pain === null) return;

    this.saving.set(true);
    this.error.set('');
    this.store
      .addInjury({
        isHistory: false,
        bodyZone: this.zone(),
        intensity: pain,
        whenOccurs: this.whenSel() || undefined,
        limitation: this.limit(),
        notes: this.notes().trim() || undefined
      })
      .subscribe({
        next: () => {
          this.toast.success('Molestia reportada');
          this.zone.set('');
          this.pain.set(null);
          this.whenSel.set('');
          this.limit.set('NONE');
          this.notes.set('');
          this.submitted.set(false);
          this.saving.set(false);
        },
        error: (e) => {
          this.error.set(apiError(e));
          this.saving.set(false);
        }
      });
  }
}