import { Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './auth.service';
import { Icon } from './icon';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';
import { initialsOf } from './team-store';

export interface NavItem {
  path: string;
  label: string;
  mobileLabel?: string;
  icon: string;
  exact?: boolean;
  badge?: number;
}

@Component({
  selector: 'app-shell-frame',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Logo, ThemeToggle],
  template: `
    <a class="skip" href="#contenido" (click)="$event.preventDefault(); content.focus()">Saltar al contenido</a>
    <div class="app-shell">
      <aside class="sidebar">
        <div class="side-top">
          <a class="side-logo" [routerLink]="home()" aria-label="LuchaSegura, ir al inicio">
            <app-logo [size]="34" />
          </a>
          <span class="in-frame"><app-theme-toggle /></span>
        </div>

        <nav class="nav" aria-label="Navegación principal">
          @for (n of items(); track n.path) {
            <a [routerLink]="n.path" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: n.exact === true }" ariaCurrentWhenActive="page">
              <app-icon [name]="n.icon" />
              <span [class.nav-label-full]="n.mobileLabel">{{ n.label }}</span>
              @if (n.mobileLabel) { <span class="nav-label-mobile" aria-hidden="true">{{ n.mobileLabel }}</span> }
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
export class ShellFrame {
  auth = inject(AuthService);

  items = input.required<NavItem[]>();
  home = input.required<string>();
  roleLabel = input.required<string>();

  initials = computed(() => initialsOf(this.auth.user()?.fullName ?? ''));
}
