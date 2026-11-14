import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, Role } from './auth.service';

// Solo para visitantes: si ya inició sesión, lo manda a donde corresponda
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const u = auth.user();
  if (!u) return true;
  return router.createUrlTree([u.mustChangePassword ? '/cambiar-contrasena' : auth.homeFor(u.role)]);
};

// Cualquier usuario con sesión
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService).user() ? true : router.createUrlTree(['/login']);
};

// Solo para los roles indicados
export const roleGuard = (...roles: Role[]): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const u = auth.user();
  if (!u) return router.createUrlTree(['/login']);
  if (u.mustChangePassword) return router.createUrlTree(['/cambiar-contrasena']);
  return roles.includes(u.role) ? true : router.createUrlTree([auth.homeFor(u.role)]);
};