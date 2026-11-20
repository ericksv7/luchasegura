import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-container',
  imports: [NgTemplateOutlet],
  template: `
    <ng-template #notice let-t>
      <div class="toast" [attr.data-kind]="t.kind">
        <span>{{ t.message }}</span>
        <button type="button" aria-label="Cerrar aviso"
          (focus)="toast.pause(t.id)" (blur)="toast.resume(t.id)" (click)="toast.dismiss(t.id)">×</button>
      </div>
    </ng-template>
    <div class="toasts">
      <div class="toast-group" aria-live="assertive">
        @for (t of urgent(); track t.id) { <ng-container *ngTemplateOutlet="notice; context: { $implicit: t }" /> }
      </div>
      <div class="toast-group" aria-live="polite">
        @for (t of polite(); track t.id) { <ng-container *ngTemplateOutlet="notice; context: { $implicit: t }" /> }
      </div>
    </div>
  `
})
export class ToastContainer {
  toast = inject(ToastService);
  urgent = computed(() => this.toast.toasts().filter(t => t.kind === 'error' || t.kind === 'warning'));
  polite = computed(() => this.toast.toasts().filter(t => t.kind === 'success' || t.kind === 'info'));
}
