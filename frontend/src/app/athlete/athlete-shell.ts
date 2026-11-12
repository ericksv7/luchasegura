import { Component, OnDestroy, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { AthleteStore } from '../core/athlete-store';

@Component({
  selector: 'app-athlete-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <a class="skip" href="#contenido">Saltar al contenido</a>
    <div class="app-shell">
      <aside class="sidebar">
        <a class="side-logo" routerLink="/deportista" aria-label="LuchaSegura, ir al inicio">
          <span class="mark">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M8.5 12l2.5 2.5L16 9.5" /></svg>
          </span>
          LuchaSegura
        </a>

        <nav class="nav" aria-label="Navegación principal">
          @for (n of items; track n.path) {
            <a [routerLink]="n.path" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                @for (d of n.d; track d) { <path [attr.d]="d" /> }
              </svg>
              <span>{{ n.label }}</span>
            </a>
          }
        </nav>

        <div class="side-user">
          <div class="avatar" aria-hidden="true">{{ initials() }}</div>
          <div class="side-name">
            <strong>{{ auth.user()?.fullName }}</strong>
            <small>Deportista</small>
          </div>
          <button type="button" class="icon-btn" aria-label="Cerrar sesión" (click)="auth.logout()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" /></svg>
          </button>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <span class="mark">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M8.5 12l2.5 2.5L16 9.5" /></svg>
          </span>
          LuchaSegura
        </header>
        <main class="content" id="contenido" tabindex="-1">
          <router-outlet />
        </main>
      </div>
    </div>
  `
})
export class AthleteShell implements OnDestroy {
  auth = inject(AuthService);
  private store = inject(AthleteStore);

  items = [
    { path: '/deportista', label: 'Inicio', d: ['M4 11l8-7 8 7v9H4z'] },
    { path: '/deportista/reportar', label: 'Reportar', d: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z', 'M12 8v8M8 12h8'] },
    { path: '/deportista/plan', label: 'Mi plan', d: ['M5 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14H5z', 'M9 9h6M9 13h6M9 17h3'] },
    { path: '/deportista/progreso', label: 'Progreso', d: ['M4 20V10M10 20V4M16 20v-7M21 20H3'] },
    { path: '/deportista/perfil', label: 'Perfil', d: ['M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', 'M4 21c1-4 4-6 8-6s7 2 8 6'] }
  ];

  initials = computed(() =>
    (this.auth.user()?.fullName ?? '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  );

  constructor() { this.store.load(); }
  ngOnDestroy() { this.store.reset(); }
}