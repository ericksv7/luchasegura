import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
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
    <div class="presentation" aria-live="polite">
      @if (presentationRoute() && presentation(); as noticeItem) {
        <ng-container *ngTemplateOutlet="notice; context: { $implicit: noticeItem }" />
      }
    </div>
    <div class="toasts">
      <div class="toast-group" aria-live="assertive">
        @for (t of urgent(); track t.id) { <ng-container *ngTemplateOutlet="notice; context: { $implicit: t }" /> }
      </div>
      <div class="toast-group" aria-live="polite">
        @for (t of polite(); track t.id) { <ng-container *ngTemplateOutlet="notice; context: { $implicit: t }" /> }
      </div>
    </div>
  `,
  styles: `
    .presentation {
      position: fixed;
      z-index: 80;
      inset-inline-end: max(12px, env(safe-area-inset-right, 0px));
      inset-block-end: max(20px, env(safe-area-inset-bottom, 0px));
      inline-size: min(22rem, calc(100% - max(12px, env(safe-area-inset-left, 0px)) - max(12px, env(safe-area-inset-right, 0px))));
      pointer-events: none;
    }
    .presentation .toast { pointer-events: none; border-inline-start: 3px solid var(--pri); }
    .presentation .toast::before { display: none; }
    .presentation button { pointer-events: auto; inline-size: 36px; block-size: 36px; }
    @media (max-width: 899px) {
      .presentation { inset-block-end: calc(var(--mobile-nav-clearance) + env(safe-area-inset-bottom, 0px)); }
    }
  `
})
export class ToastContainer {
  toast = inject(ToastService);
  private router = inject(Router);
  presentation = computed(() => this.toast.toasts().find(t => t.kind === 'presentation'));
  presentationRoute = toSignal(this.router.events.pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    map(event => /^\/(admin|equipo|deportista|cambiar-contrasena)(?:[/?#;]|$)/.test(event.urlAfterRedirects)),
  ), { initialValue: false });
  urgent = computed(() => this.toast.toasts().filter(t => t.kind === 'error' || t.kind === 'warning'));
  polite = computed(() => this.toast.toasts().filter(t => t.kind === 'success' || t.kind === 'info'));
}
