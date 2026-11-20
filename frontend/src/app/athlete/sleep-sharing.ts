import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { apiError } from '../core/auth.service';
import { SleepApi, SleepSharingState } from '../core/sleep-api';

@Component({
  selector: 'app-sleep-sharing',
  host: { style: 'display:block; min-inline-size:0' },
  template: `
    <section class="card" aria-labelledby="sleep-sharing-title">
      <h2 id="sleep-sharing-title">Privacidad del sueño</h2>
      <details #panel class="disclosure" (toggle)="panel.open && !state() && load()">
        <summary>Compartir horas de sueño con mi entrenador</summary>
        @if (loading()) { <p role="status">Cargando autorización…</p> }
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
          <button type="button" class="btn secondary" [disabled]="loading()" (click)="load()">Consultar estado</button>
        }
        @if (message()) { <p role="status">{{ message() }}</p> }
        @if (state(); as current) {
          @if (current.coach; as coach) { <p>Entrenador asignado: <strong>{{ coach.name }}</strong></p> }
          @if (current.disabledReason) { <p>{{ current.disabledReason }}</p> }
          @if (current.active) { <p>Compartición activa.</p> }
          @if (current.canRevoke) {
            <button type="button" class="btn secondary" [disabled]="saving() || loading()" (click)="save(false)">
              Retirar acceso al sueño
            </button>
          } @else if (!current.disabledReason && current.coach) {
            @if (current.status === 'draft') { <p class="meta">Autorización de demostración para datos sintéticos.</p> }
            <form class="form" (submit)="$event.preventDefault(); save(true)">
              <label class="sleep-permission">
                <input type="checkbox" [checked]="accepted()" [disabled]="saving() || loading()"
                  (change)="accepted.set($any($event.target).checked)" />
                <span>{{ current.text }}</span>
              </label>
              <div class="actions">
                <button class="btn" [disabled]="!accepted() || saving() || loading()">Autorizar acceso al sueño</button>
              </div>
            </form>
          }
        }
      </details>
    </section>
  `,
  styles: [`
    .sleep-permission { display: flex; align-items: start; gap: .75rem; min-block-size: 44px; }
    .sleep-permission input { flex: none; inline-size: 1.25rem; block-size: 1.25rem; accent-color: var(--pri); }
    .sleep-permission input:focus-visible { outline: 2px solid var(--pri); outline-offset: 2px; }
  `],
})
export class SleepSharing {
  private readonly api = inject(SleepApi);
  private readonly destroy = inject(DestroyRef);
  readonly state = signal<SleepSharingState | null>(null);
  readonly accepted = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly message = signal('');
  readonly error = signal('');

  load() {
    if (this.loading() || this.saving()) return;
    this.loading.set(true);
    this.accepted.set(false);
    this.error.set('');
    this.api.sharingState().pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: value => { this.state.set(value); this.loading.set(false); },
      error: error => { this.state.set(null); this.error.set(apiError(error)); this.loading.set(false); },
    });
  }

  save(grant: boolean) {
    if (this.saving() || this.loading()) return;
    const state = this.state();
    if (!state || (grant && (!this.accepted() || !state.coach || state.disabledReason))) return;
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    const request = grant ? this.api.grant(state.coach!.id, state.noticeVersion) : this.api.revoke();
    request.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => {
        this.saving.set(false);
        this.state.set(null);
        this.message.set(grant ? 'Autorización guardada.' : 'El acceso del entrenador se retiró.');
        this.load();
      },
      error: error => {
        this.saving.set(false);
        this.accepted.set(false);
        this.error.set(apiError(error));
      },
    });
  }
}
