import { Component, OnDestroy, inject } from '@angular/core';
import { AthleteStore } from '../core/athlete-store';
import { NavItem, ShellFrame } from '../core/shell-frame';

@Component({
  selector: 'app-athlete-shell',
  imports: [ShellFrame],
  template: `<app-shell-frame [items]="items" home="/deportista" roleLabel="Deportista" />`
})
export class AthleteShell implements OnDestroy {
  private store = inject(AthleteStore);

  items: NavItem[] = [
    { path: '/deportista', label: 'Inicio', icon: 'home', exact: true },
    { path: '/deportista/reportar', label: 'Reportar', icon: 'plus-circle' },
    { path: '/deportista/plan', label: 'Mi plan', icon: 'clipboard' },
    { path: '/deportista/progreso', label: 'Progreso', icon: 'chart' },
    { path: '/deportista/perfil', label: 'Perfil', icon: 'user' }
  ];

  constructor() { this.store.load(); }
  ngOnDestroy() { this.store.reset(); }
}