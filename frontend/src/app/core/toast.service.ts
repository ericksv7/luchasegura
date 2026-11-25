import { DOCUMENT, Injectable, inject, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info' | 'warning' | 'presentation';
export interface Toast { id: number; kind: ToastKind; message: string; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private document = inject(DOCUMENT);
  private next = 1;
  private timers = new Map<number, ReturnType<typeof setTimeout>>();

  show(kind: ToastKind, message: string, ms = 4000) {
    const id = this.next++;
    this.toasts.update((t) => [...t, { id, kind, message }]);
    this.expire(id, ms);
  }

  showPresentation() {
    if (this.document.querySelector('meta[name="luchasegura-presentation"]')?.getAttribute('content') !== '1') return;
    this.dismissPresentation();
    this.show('presentation', 'Entorno de demostración. Los datos son ficticios. No ingreses información personal ni de salud real.', 12_000);
  }

  dismissPresentation() {
    const notice = this.toasts().find(toast => toast.kind === 'presentation');
    if (notice) this.dismiss(notice.id);
  }

  success(message: string) { this.show('success', message); }
  error(message: string) { this.show('error', message, 6000); }
  info(message: string) { this.show('info', message); }
  warning(message: string) { this.show('warning', message, 6000); }

  pause(id: number) {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
  }

  resume(id: number) {
    if (this.toasts().some(toast => toast.id === id)) this.expire(id, 6000);
  }

  private expire(id: number, ms: number) {
    this.pause(id);
    this.timers.set(id, setTimeout(() => this.dismiss(id), ms));
  }

  dismiss(id: number) {
    this.pause(id);
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }
}