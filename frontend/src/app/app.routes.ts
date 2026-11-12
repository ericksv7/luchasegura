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
    path: 'olvide-contrasena',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/forgot.page').then((m) => m.ForgotPage)
  },
  {
    path: 'restablecer',
    loadComponent: () => import('./pages/reset.page').then((m) => m.ResetPage)
  },
  {
    path: 'deportista',
    canActivate: [roleGuard('ATHLETE')],
    loadComponent: () => import('./athlete/athlete-shell').then((m) => m.AthleteShell),
    children: [
      { path: '', pathMatch: 'full', title: 'Inicio · LuchaSegura', loadComponent: () => import('./athlete/home.page').then((m) => m.HomePage) },
      { path: 'reportar', title: 'Reportar · LuchaSegura', loadComponent: () => import('./athlete/report.page').then((m) => m.ReportPage) },
      { path: 'plan', title: 'Mi plan · LuchaSegura', loadComponent: () => import('./athlete/plan.page').then((m) => m.PlanPage) },
      { path: 'progreso', title: 'Progreso · LuchaSegura', loadComponent: () => import('./athlete/progress.page').then((m) => m.ProgressPage) },
      { path: 'perfil', title: 'Perfil · LuchaSegura', loadComponent: () => import('./athlete/profile.page').then((m) => m.ProfilePage) }
    ]
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