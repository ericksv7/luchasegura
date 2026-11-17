import { ApplicationRef, Injectable, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
const KEY = 'ls_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private app = inject(ApplicationRef);
  private transitioning = false;
  readonly theme = signal<Theme>(this.initial());

  constructor() {
    this.apply(this.theme());
  }

  async toggle(origin?: EventTarget | null) {
    if (this.transitioning) return;
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    const update = () => {
      this.theme.set(next);
      this.apply(next);
      try { localStorage.setItem(KEY, next); } catch { /* sin almacenamiento */ }
    };
    if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      update();
      return;
    }

    const root = document.documentElement;
    const rect = origin instanceof Element ? origin.getBoundingClientRect() : null;
    const x = rect ? rect.left + rect.width / 2 : innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : innerHeight / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.style.setProperty('--theme-x', `${x}px`);
    root.style.setProperty('--theme-y', `${y}px`);
    root.style.setProperty('--theme-radius', `${Math.ceil(radius)}px`);
    root.classList.add('theme-transition');
    this.transitioning = true;
    try {
      const transition = document.startViewTransition(() => {
        update();
        // Actualizar también los controles Angular antes de capturar el nuevo tema.
        this.app.tick();
      });
      void transition.ready.catch(() => { /* transición omitida por el navegador */ });
      await transition.finished;
    } catch {
      update();
    } finally {
      root.classList.remove('theme-transition');
      for (const name of ['--theme-x', '--theme-y', '--theme-radius']) root.style.removeProperty(name);
      this.transitioning = false;
    }
  }

  private apply(t: Theme) {
    document.documentElement.setAttribute('data-theme', t);
  }

  private initial(): Theme {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* sin almacenamiento */ }
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
