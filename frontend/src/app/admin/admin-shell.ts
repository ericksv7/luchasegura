import { Component, OnDestroy, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { AdminStore } from '../core/admin-store';
import { initialsOf } from '../core/team-store';
import { Logo } from '../core/logo';
import { ThemeToggle } from '../core/theme-toggle';
import { Icon } from '../core/icon';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Logo, ThemeToggle, Icon],
  template: `
    <a class="skip" href="#contenido" (click)="$event.preventDefault(); content.focus()">Saltar al contenido</a>
    <div class="app-shell">
      <aside class="sidebar">
        <div class="side-top">
          <a class="side-logo" routerLink="/admin" aria-label="LuchaSegura, ir a usuarios">
            <app-logo [size]="34" />
          </a>
          <span class="in-frame"><app-theme-toggle /></span>
        </div>

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
          <button type="button" class="icon-btn" aria-label="Cerrar sesión" title="Cerrar sesión" (click)="auth.askLogout()">
            <app-icon name="logout" />
          </button>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <span class="logo-lite"><app-logo [size]="30" /></span>
          <div class="topbar-actions">
            <span class="in-frame"><app-theme-toggle /></span>
            <button type="button" class="icon-btn" aria-label="Cerrar sesión" title="Cerrar sesión" (click)="auth.askLogout()"><app-icon name="logout" /></button>
          </div>
        </header>
        <main #content class="content" id="contenido" tabindex="-1">
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
