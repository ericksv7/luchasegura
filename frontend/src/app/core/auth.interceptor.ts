import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token;
  const authReq =
    token && req.url.startsWith('/api')
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      // Sesión vencida o inválida: se cierra y se vuelve al login
      if (err.status === 401 && !req.url.includes('/api/auth/login')) auth.logout();
      return throwError(() => err);
    })
  );
};