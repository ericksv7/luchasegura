import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';
export interface Toast { id: number; kind: ToastKind; message: string; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private next = 1;

  show(kind: ToastKind, message: string, ms = 4000) {
    const id = this.next++;
    this.toasts.update((t) => [...t, { id, kind, message }]);
    setTimeout(() => this.dismiss(id), ms);
  }

  success(message: string) { this.show('success', message); }
  error(message: string) { this.show('error', message, 6000); }
  info(message: string) { this.show('info', message); }
  warning(message: string) { this.show('warning', message, 6000); }

  dismiss(id: number) {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }
}