import { Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './auth.service';
import { Icon } from './icon';
import { ThemeToggle } from './theme-toggle';
import { initialsOf } from './team-store';

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  exact?: boolean;
  badge?: number;
}

@Component({
  selector: 'app-shell-frame',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, ThemeToggle],
  template: `
    <a class="skip" href="#contenido">Saltar al contenido</a>
    <div class="app-shell">
      <aside class="sidebar">
        <div class="side-top">
          <a class="side-logo" [routerLink]="home()" aria-label="LuchaSegura, ir al inicio">
            <span class="mark">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M8.5 12l2.5 2.5L16 9.5" /></svg>
            </span>
            LuchaSegura
          </a>
          <span class="in-frame"><app-theme-toggle /></span>
        </div>

        <nav class="nav" aria-label="Navegación principal">
          @for (n of items(); track n.path) {
            <a [routerLink]="n.path" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: n.exact === true }" ariaCurrentWhenActive="page">
              <app-icon [name]="n.icon" />
              <span>{{ n.label }}</span>
              @if (n.badge) {
                <span class="nav-badge" aria-hidden="true">{{ n.badge }}</span>
                <span class="sr-only">, {{ n.badge }} por revisar</span>
              }
            </a>
          }
        </nav>

        <div class="side-user">
          <div class="avatar" aria-hidden="true">{{ initials() }}</div>
          <div class="side-name">
            <strong>{{ auth.user()?.fullName }}</strong>
            <small>{{ roleLabel() }}</small>
          </div>
          <button type="button" class="icon-btn" aria-label="Cerrar sesión" (click)="auth.askLogout()">
            <app-icon name="logout" />
          </button>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <span class="logo-lite">
            <span class="mark">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M8.5 12l2.5 2.5L16 9.5" /></svg>
            </span>
            LuchaSegura
          </span>
          <span class="in-frame"><app-theme-toggle /></span>
        </header>
        <main class="content" id="contenido" tabindex="-1">
          <router-outlet />
        </main>
      </div>
    </div>
  `
})
export class ShellFrame {
  auth = inject(AuthService);

  items = input.required<NavItem[]>();
  home = input.required<string>();
  roleLabel = input.required<string>();

  initials = computed(() => initialsOf(this.auth.user()?.fullName ?? ''));
}