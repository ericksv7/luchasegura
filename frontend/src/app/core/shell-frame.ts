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
            <a [routerLink]="n.path" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: n.exact === true }"
              ariaCurrentWhenActive="page" (click)="pulseIcon(icon)"
              (isActiveChange)="$event && !icon.classList.contains('pulse') && pulseIcon(icon)">
              <span #icon class="nav-icon" (animationend)="icon.classList.remove('pulse')"
                (animationcancel)="icon.classList.remove('pulse')">
                <app-icon [name]="n.icon" />
              </span>
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
  `,
  styles: [`
    .nav-icon { display: grid; flex: none; place-items: center; }
    @media (min-width: 900px) and (prefers-reduced-motion: no-preference) {
      .nav-icon.pulse { animation: nav-icon-pulse 240ms ease-in-out; }
      @keyframes nav-icon-pulse {
        0%, 100% { transform: scale(1); }
        38%, 50% { transform: scale(1.12); }
      }
    }
  `],
})
export class ShellFrame {
  auth = inject(AuthService);

  items = input.required<NavItem[]>();
  home = input.required<string>();
  roleLabel = input.required<string>();

  initials = computed(() => initialsOf(this.auth.user()?.fullName ?? ''));

  pulseIcon(icon: HTMLElement) {
    if (!matchMedia('(min-width: 900px) and (prefers-reduced-motion: no-preference)').matches) return;
    // Una activación repetida reinicia la pulsación aunque la ruta siga seleccionada.
    const animation = icon.getAnimations()[0];
    if (animation) animation.currentTime = 0;
    else icon.classList.add('pulse');
  }
}
