import { Component, OnDestroy, computed, inject } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { NavItem, ShellFrame } from '../core/shell-frame';
import { TeamStore } from '../core/team-store';

@Component({
  selector: 'app-team-shell',
  imports: [ShellFrame],
  template: `<app-shell-frame [items]="items()" home="/equipo" [roleLabel]="role()" />`
})
export class TeamShell implements OnDestroy {
  private auth = inject(AuthService);
  private store = inject(TeamStore);

  role = computed(() => (this.auth.user()?.role === 'PHYSIO' ? 'Fisioterapeuta' : 'Entrenador'));

  items = computed<NavItem[]>(() => {
    const list: NavItem[] = [
      { path: '/equipo', label: 'Resumen', icon: 'grid', exact: true },
      { path: '/equipo/alertas', label: 'Alertas', icon: 'alert', badge: this.store.stats()?.newAlerts ?? 0 },
      { path: '/equipo/deportistas', label: 'Deportistas', icon: 'users' },
      { path: '/equipo/ejercicios', label: 'Ejercicios', icon: 'dumbbell' }
    ];
    if (this.auth.user()?.role === 'PHYSIO') list.push({ path: '/equipo/umbrales', label: 'Umbrales', icon: 'sliders' });
    return list;
  });

  constructor() { this.store.load(); }
  ngOnDestroy() { this.store.reset(); }
}