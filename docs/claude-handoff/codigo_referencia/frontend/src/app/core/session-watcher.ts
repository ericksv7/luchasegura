import { Injectable, NgZone, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

// Cierra la sesión por inactividad o cuando el token vence
@Injectable({ providedIn: 'root' })
export class SessionWatcher {
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private zone = inject(NgZone);
  private started = false;
  private lastWrite = 0;

  start() {
    if (this.started) return;
    this.started = true;

    this.zone.runOutsideAngular(() => {
      const touch = () => {
        if (!this.auth.user()) return;
        const now = Date.now();
        if (now - this.lastWrite > 5000) {
          this.lastWrite = now;
          this.auth.markActive();
        }
      };
      for (const e of ['pointerdown', 'keydown', 'scroll', 'touchstart']) {
        window.addEventListener(e, touch, { passive: true, capture: true });
      }

      const check = () => {
        if (!this.auth.user()) return;
        const why = this.auth.sessionExpired();
        if (!why) return;
        this.zone.run(() => {
          this.auth.logout();
          this.toast.info(
            why === 'idle'
              ? 'Tu sesión se cerró por inactividad. Inicia sesión de nuevo.'
              : 'Tu sesión venció. Inicia sesión de nuevo.'
          );
        });
      };
      setInterval(check, 15_000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    });
  }
}