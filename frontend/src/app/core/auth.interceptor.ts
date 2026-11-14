import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, finalize, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { LoadingService } from './loading';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const loading = inject(LoadingService);
  const token = auth.token;
  const authReq =
    token && req.url.startsWith('/api')
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  loading.start();
  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !req.url.includes('/api/auth/login')) {
        // Sesión vencida, cuenta desactivada o contraseña cambiada en otro lugar
        auth.logout();
      } else if (err.status === 403 && err.error?.code === 'PASSWORD_CHANGE_REQUIRED') {
        auth.requirePasswordChange();
      }
      return throwError(() => err);
    }),
    finalize(() => loading.end())
  );
};