import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ActivatedRouteSnapshot, provideRouter, withViewTransitions } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withViewTransitions({
      onViewTransitionCreated: ({ transition, to }) => {
        const isAlertRoute = (route: ActivatedRouteSnapshot): boolean =>
          route.routeConfig?.path === 'alertas' || route.routeConfig?.path === 'alertas/:id' || route.children.some(isAlertRoute);
        // Mostrar rise en el DOM vivo, sin que el fundido de la captura de página lo oculte.
        if (isAlertRoute(to)) transition.skipTransition();
      }
    })),
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
};