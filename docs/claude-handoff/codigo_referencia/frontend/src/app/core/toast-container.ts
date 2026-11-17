import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-container',
  template: `
    <div class="toasts" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [attr.data-kind]="t.kind" [attr.role]="t.kind === 'error' ? 'alert' : 'status'">
          <span>{{ t.message }}</span>
          <button type="button" aria-label="Cerrar aviso" (click)="toast.dismiss(t.id)">×</button>
        </div>
      }
    </div>
  `
})
export class ToastContainer {
  toast = inject(ToastService);
}