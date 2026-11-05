import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, Role } from './auth.service';

// Solo para visitantes: si ya inició sesión, lo manda a su panel
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const u = auth.user();
  return u ? router.createUrlTree([auth.homeFor(u.role)]) : true;
};

// Solo para los roles indicados
export const roleGuard = (...roles: Role[]): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const u = auth.user();
  if (!u) return router.createUrlTree(['/login']);
  return roles.includes(u.role) ? true : router.createUrlTree([auth.homeFor(u.role)]);
};