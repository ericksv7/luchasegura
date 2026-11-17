import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';

// Cuenta regresiva basada en la hora de fin, para que no se desfase si la pestaña queda en segundo plano
export function createCountdown() {
  const destroyRef = inject(DestroyRef);
  const remaining = signal(0);
  const total = signal(0);
  let endAt = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
  destroyRef.onDestroy(stop);

  const tick = () => {
    const s = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    remaining.set(s);
    if (s === 0) stop();
  };

  return {
    active: computed(() => remaining() > 0),
    text: computed(() => {
      const s = remaining();
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }),
    // Texto fijo para lectores de pantalla: no se repite cada segundo
    announce: computed(() => {
      const t = total();
      if (t < 60) return 'Espera unos segundos para volver a intentarlo.';
      const m = Math.ceil(t / 60);
      return `Espera ${m} ${m === 1 ? 'minuto' : 'minutos'} para volver a intentarlo.`;
    }),
    start(seconds: number) {
      stop();
      const s = Math.max(1, Math.round(seconds));
      total.set(s);
      endAt = Date.now() + s * 1000;
      tick();
      timer = setInterval(tick, 500);
    }
  };
}
export type Countdown = ReturnType<typeof createCountdown>;

@Component({
  selector: 'app-lockout',
  template: `
    @if (cd().active()) {
      <div class="lockout">
        <span class="sr-only" role="alert">Demasiados intentos. {{ cd().announce() }}</span>
        <p aria-hidden="true">Demasiados intentos. Podrás intentarlo de nuevo en</p>
        <strong class="lockout-time" aria-hidden="true">{{ cd().text() }}</strong>
      </div>
    }
  `
})
export class Lockout {
  cd = input.required<Countdown>();
}