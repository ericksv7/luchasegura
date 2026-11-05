import { Routes } from '@angular/router';
import { guestGuard, roleGuard } from './core/guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login.page').then((m) => m.LoginPage)
  },
  {
    path: 'registro',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/register.page').then((m) => m.RegisterPage)
  },
  {
    path: 'deportista',
    canActivate: [roleGuard('ATHLETE')],
    data: { title: 'Panel del deportista' },
    loadComponent: () => import('./pages/panel.page').then((m) => m.PanelPage)
  },
  {
    path: 'equipo',
    canActivate: [roleGuard('COACH', 'PHYSIO')],
    data: { title: 'Panel del equipo' },
    loadComponent: () => import('./pages/panel.page').then((m) => m.PanelPage)
  },
  {
    path: 'admin',
    canActivate: [roleGuard('ADMIN')],
    data: { title: 'Administración' },
    loadComponent: () => import('./pages/panel.page').then((m) => m.PanelPage)
  },
  { path: '**', redirectTo: 'login' }
];