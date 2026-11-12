import { Component, OnDestroy, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { AdminStore } from '../core/admin-store';
import { initialsOf } from '../core/team-store';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <a class="skip" href="#contenido">Saltar al contenido</a>
    <div class="app-shell">
      <aside class="sidebar">
        <a class="side-logo" routerLink="/admin" aria-label="LuchaSegura, ir a usuarios">
          <span class="mark">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M8.5 12l2.5 2.5L16 9.5" /></svg>
          </span>
          LuchaSegura
        </a>

        <nav class="nav" aria-label="Navegación principal">
          @for (n of items; track n.path) {
            <a [routerLink]="n.path" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: n.exact }" ariaCurrentWhenActive="page">
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
            <small>Administrador</small>
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
export class AdminShell implements OnDestroy {
  auth = inject(AuthService);
  private store = inject(AdminStore);

  items = [
    { path: '/admin', label: 'Usuarios', exact: true, d: ['M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2', 'M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M21 20v-2a4 4 0 0 0-3-3.9', 'M16 2.1a4 4 0 0 1 0 7.8'] },
    { path: '/admin/asignaciones', label: 'Asignaciones', exact: false, d: ['M16 3h5v5', 'M21 3l-7 7', 'M8 21H3v-5', 'M3 21l7-7', 'M21 16v5h-5', 'M3 8V3h5'] }
  ];

  initials = computed(() => initialsOf(this.auth.user()?.fullName ?? ''));

  constructor() { this.store.load(); }
  ngOnDestroy() { this.store.reset(); }
}