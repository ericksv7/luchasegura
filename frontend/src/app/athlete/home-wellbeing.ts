import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { bogotaDay } from '../core/civil-date';
import { WellbeingApi, WellbeingPageResult } from '../core/wellbeing-api';
import { WellbeingSnapshot } from '../core/wellbeing-snapshot';

@Component({
  selector: 'app-home-wellbeing',
  imports: [RouterLink, WellbeingSnapshot],
  template: `
    <section class="home-wellbeing" aria-labelledby="home-wellbeing-title">
      <header>
        <h2 id="home-wellbeing-title">Mi bienestar</h2>
        @if (result()?.entries?.length) {
          <p>Último registro</p>
        } @else if (loading()) {
          <p role="status">Cargando bienestar…</p>
        } @else if (failed()) {
          <p role="status">No pudimos cargar tu bienestar.</p>
        } @else if (canRecord()) {
          <p>Aún no tienes registros. Empieza con las horas que dormiste o con cómo te sientes.</p>
        } @else {
          <p>Aún no tienes registros. Podrás registrar tu bienestar cuando comience la intervención.</p>
        }
        <div class="wellbeing-links">
          @if (canRecord()) {
            <a class="btn" routerLink="/deportista/bienestar" [queryParams]="{ registrar: 1 }">Registrar bienestar</a>
          } @else if (failed()) {
            <button class="btn secondary" type="button" (click)="load()">Reintentar bienestar</button>
          }
          <div class="secondary-links">
            <a routerLink="/deportista/bienestar">Ver mi bienestar</a>
            <a routerLink="/deportista/progreso">Consultar progreso</a>
          </div>
        </div>
      </header>
      @if (result()?.entries?.[0]; as latest) {
        <app-wellbeing-snapshot [entry]="latest" [showScale]="true" />
      }
    </section>
  `,
  styles: [`
    :host { display: block; margin-block-end: 1.25rem; }
    .home-wellbeing { display: grid; align-items: start; gap: 1rem 1.5rem; min-inline-size: 0; padding: clamp(1rem, 2.5vw, 1.75rem); background: var(--soft); border-radius: var(--r-lg); }
    .home-wellbeing:has(app-wellbeing-snapshot) { grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr)); }
    header { min-inline-size: 0; }
    h2 { margin: 0; font-size: clamp(1.3rem, 1.15rem + .6vw, 1.75rem); }
    p { margin-block: .35rem .75rem; max-inline-size: 48ch; }
    .wellbeing-links { display: grid; justify-items: start; gap: .25rem; }
    .secondary-links { display: flex; flex-wrap: wrap; gap: 0 .9rem; }
    .wellbeing-links a { display: inline-flex; align-items: center; min-block-size: 44px; white-space: normal; }
  `],
})
export class HomeWellbeing {
  private readonly api = inject(WellbeingApi);
  private readonly destroy = inject(DestroyRef);
  readonly result = signal<WellbeingPageResult | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly canRecord = computed(() => {
    const data = this.result();
    return !!data?.intervention && data.intervention.startedOn <= (data.today ?? bogotaDay());
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.failed.set(false);
    this.api.list().pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: data => { this.result.set(data); this.loading.set(false); },
      error: () => { this.failed.set(true); this.loading.set(false); },
    });
  }
}
