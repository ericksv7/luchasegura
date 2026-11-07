import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-state',
  template: `
    <div class="state" [attr.data-kind]="kind()" [attr.role]="kind() === 'error' ? 'alert' : 'status'">
      <span class="state-icon" aria-hidden="true">
        @switch (kind()) {
          @case ('success') { <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.8" /></svg> }
          @case ('error') { <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h.01" /></svg> }
          @default { <svg viewBox="0 0 24 24"><path d="M3 13l3-8h12l3 8v6H3z" /><path d="M3 13h5l1 3h6l1-3h5" /></svg> }
        }
      </span>
      <h2>{{ title() }}</h2>
      @if (text()) { <p>{{ text() }}</p> }
      @if (action()) {
        <button type="button" class="btn" (click)="act.emit()">{{ action() }}</button>
      }
    </div>
  `
})
export class StateView {
  kind = input<'empty' | 'error' | 'success'>('empty');
  title = input.required<string>();
  text = input('');
  action = input('');
  act = output<void>();
}