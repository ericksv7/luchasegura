import { Component, OnDestroy, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { TeamStore, initialsOf } from '../core/team-store';

interface NavItem {
  path: string;
  label: string;
  exact: boolean;
  alerts: boolean;
  physio?: boolean;
  d: string[];
}

@Component({
  selector: 'app-team-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <a class="skip" href="#contenido">Saltar al contenido</a>
    <div class="app-shell">
      <aside class="sidebar">
        <a class="side-logo" routerLink="/equipo" aria-label="LuchaSegura, ir al resumen">
          <span class="mark">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M8.5 12l2.5 2.5L16 9.5" /></svg>
          </span>
          LuchaSegura
        </a>

        <nav class="nav" aria-label="Navegación principal">
          @for (n of visible(); track n.path) {
            <a [routerLink]="n.path" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: n.exact }" ariaCurrentWhenActive="page">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                @for (d of n.d; track d) { <path [attr.d]="d" /> }
              </svg>
              <span>{{ n.label }}</span>
              @if (n.alerts && (store.stats()?.newAlerts ?? 0) > 0) {
                <span class="nav-badge" aria-hidden="true">{{ store.stats()!.newAlerts }}</span>
                <span class="sr-only">, {{ store.stats()!.newAlerts }} por revisar</span>
              }
            </a>
          }
        </nav>

        <div class="side-user">
          <div class="avatar" aria-hidden="true">{{ initials() }}</div>
          <div class="side-name">
            <strong>{{ auth.user()?.fullName }}</strong>
            <small>{{ role() }}</small>
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
export class TeamShell implements OnDestroy {
  auth = inject(AuthService);
  store = inject(TeamStore);

  items: NavItem[] = [
    { path: '/equipo', label: 'Resumen', exact: true, alerts: false, d: ['M4 5h7v7H4z', 'M13 5h7v4h-7z', 'M13 11h7v8h-7z', 'M4 14h7v5H4z'] },
    { path: '/equipo/alertas', label: 'Alertas', exact: false, alerts: true, d: ['M12 3l9 16H3z', 'M12 10v4M12 17h.01'] },
    { path: '/equipo/deportistas', label: 'Deportistas', exact: false, alerts: false, d: ['M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2', 'M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M21 20v-2a4 4 0 0 0-3-3.9', 'M16 2.1a4 4 0 0 1 0 7.8'] },
    { path: '/equipo/umbrales', label: 'Umbrales', exact: false, alerts: false, physio: true, d: ['M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4'] }
  ];

  role = computed(() => (this.auth.user()?.role === 'PHYSIO' ? 'Fisioterapeuta' : 'Entrenador'));
  visible = computed(() => this.items.filter((n) => !n.physio || this.auth.user()?.role === 'PHYSIO'));
  initials = computed(() => initialsOf(this.auth.user()?.fullName ?? ''));

  constructor() { this.store.load(); }
  ngOnDestroy() { this.store.reset(); }
}