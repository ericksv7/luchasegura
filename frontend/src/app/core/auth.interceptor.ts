import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, finalize, from, map, mergeMap, of, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { shakeInvalid } from './fx';
import { LoadingService } from './loading';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const loading = inject(LoadingService);
  const token = auth.token;
  const authReq =
    token && req.url.startsWith('/api') && !req.headers.has('Authorization')
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  const handle = (err: HttpErrorResponse) => {
    const isLogin = req.url.includes('/api/auth/login');
    const isCurrentSession = !!token && authReq !== req && token === auth.token;
    if (isCurrentSession && !isLogin && (err.status === 401 || (err.status === 403 && err.error?.code === 'ROLE_CHANGED'))) {
      // Sesión vencida, cuenta desactivada o contraseña cambiada en otro lugar
      auth.logout();
    } else if (err.status === 403 && isCurrentSession && err.error?.code === 'PASSWORD_CHANGE_REQUIRED') {
      auth.requirePasswordChange();
    } else if (err.status >= 400 && err.status < 500) {
      // Error de datos o credenciales: los campos vibran cuando Angular ya pintó el mensaje
      setTimeout(shakeInvalid, 80);
    }
    return throwError(() => err);
  };

  loading.start();
  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 403 || !(err.error instanceof Blob)) return handle(err);
      return from(err.error.text()).pipe(
        map(body => new HttpErrorResponse({
          error: JSON.parse(body), headers: err.headers, status: err.status, statusText: err.statusText, url: err.url ?? undefined
        })),
        catchError(() => of(err)),
        // Comprobar el token vigente después de leer el cuerpo asíncrono.
        mergeMap(handle)
      );
    }),
    finalize(() => loading.end())
  );
};