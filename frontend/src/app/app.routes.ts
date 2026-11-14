import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards';

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
    path: 'cambiar-contrasena',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/change-password.page').then((m) => m.ChangePasswordPage)
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
    loadComponent: () => import('./team/team-shell').then((m) => m.TeamShell),
    children: [
      { path: '', pathMatch: 'full', title: 'Resumen · LuchaSegura', loadComponent: () => import('./team/overview.page').then((m) => m.TeamOverviewPage) },
      { path: 'alertas', title: 'Alertas · LuchaSegura', loadComponent: () => import('./team/alerts.page').then((m) => m.TeamAlertsPage) },
      { path: 'deportistas', title: 'Deportistas · LuchaSegura', loadComponent: () => import('./team/athletes.page').then((m) => m.TeamAthletesPage) },
      { path: 'deportistas/:id', title: 'Ficha del deportista · LuchaSegura', loadComponent: () => import('./team/athlete-detail.page').then((m) => m.AthleteDetailPage) },
      { path: 'umbrales', title: 'Umbrales · LuchaSegura', loadComponent: () => import('./team/rules.page').then((m) => m.TeamRulesPage) }
    ]
  },
  {
    path: 'admin',
    canActivate: [roleGuard('ADMIN')],
    loadComponent: () => import('./admin/admin-shell').then((m) => m.AdminShell),
    children: [
      { path: '', pathMatch: 'full', title: 'Usuarios · LuchaSegura', loadComponent: () => import('./admin/users.page').then((m) => m.AdminUsersPage) },
      { path: 'asignaciones', title: 'Asignaciones · LuchaSegura', loadComponent: () => import('./admin/assignments.page').then((m) => m.AdminAssignmentsPage) }
    ]
  },
  { path: '**', redirectTo: 'login' }
];