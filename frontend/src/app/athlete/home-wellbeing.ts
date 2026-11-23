import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { WellbeingApi, WellbeingEntry } from '../core/wellbeing-api';
import { WellbeingSnapshot } from '../core/wellbeing-snapshot';

@Component({
  selector: 'app-home-wellbeing',
  imports: [RouterLink, WellbeingSnapshot],
  template: `
    <section class="home-wellbeing" aria-labelledby="home-wellbeing-title">
      <h2 id="home-wellbeing-title">Mi bienestar</h2>
      @if (entry(); as latest) {
        <app-wellbeing-snapshot [entry]="latest" [showScale]="true" [compact]="true" />
      } @else if (loading()) {
        <p role="status">Cargando bienestar…</p>
      } @else if (failed()) {
        <p role="status">No pudimos cargar tu bienestar.</p>
        <button class="btn secondary" type="button" (click)="load()">Reintentar bienestar</button>
      } @else {
        <p>Aún no tienes registros.</p>
      }
      <a routerLink="/deportista/bienestar">Ver mi bienestar</a>
    </section>
  `,
  styles: [`
    :host { display: block; min-inline-size: 0; }
    .home-wellbeing {
      padding: 1rem;
      background: var(--soft);
      border-radius: var(--r-lg);
    }
    h2 { margin: 0 0 .45rem; font-size: var(--text-section); }
    p { margin: .35rem 0; }
    a { display: inline-flex; align-items: center; min-block-size: 44px; padding-block: .15rem; }
  `],
})
export class HomeWellbeing {
  private readonly api = inject(WellbeingApi);
  private readonly destroy = inject(DestroyRef);
  readonly entry = signal<WellbeingEntry | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.failed.set(false);
    this.api.list().pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: data => { this.entry.set(data.entries[0] ?? null); this.loading.set(false); },
      error: () => { this.failed.set(true); this.loading.set(false); },
    });
  }
}
