import { Component, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

let nextId = 0;

@Component({
  selector: 'app-field',
  imports: [ReactiveFormsModule],
  template: `
    <div class="field">
      <label [attr.for]="id">{{ label() }}</label>
      <div class="input-wrap">
        <input
          [id]="id"
          [type]="isPassword && visible() ? 'text' : type()"
          [formControl]="control()"
          [attr.autocomplete]="autocomplete() || null"
          [attr.aria-invalid]="showError ? 'true' : null"
          [attr.aria-describedby]="describedBy" />
        @if (isPassword) {
          <button
            type="button"
            class="eye"
            (click)="visible.set(!visible())"
            [attr.aria-label]="visible() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
            [attr.aria-pressed]="visible()">
            @if (visible()) {
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 3l18 18" />
                <path d="M10.6 6.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 4.4-1" />
              </svg>
            } @else {
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
              </svg>
            }
          </button>
        }
      </div>
      @if (showError) {
        <small class="msg" [id]="id + '-err'" role="alert">{{ message }}</small>
      } @else if (hint()) {
        <small class="hint" [id]="id + '-hint'">{{ hint() }}</small>
      }
    </div>
  `
})
export class Field {
  label = input.required<string>();
  control = input.required<FormControl<string>>();
  type = input<'text' | 'email' | 'password'>('text');
  autocomplete = input('');
  hint = input('');

  readonly id = `field-${nextId++}`;
  visible = signal(false);

  get isPassword() { return this.type() === 'password'; }

  get showError() {
    const c = this.control();
    return c.invalid && (c.touched || c.dirty);
  }

  get message() {
    const e = this.control().errors;
    if (!e) return '';
    if (e['required']) return 'Este campo es obligatorio';
    if (e['email']) return 'Escribe un correo válido';
    if (e['minlength']) return `Mínimo ${e['minlength'].requiredLength} caracteres`;
    if (e['mismatch']) return 'Las contraseñas no coinciden';
    return 'Revisa este campo';
  }

  get describedBy() {
    if (this.showError) return `${this.id}-err`;
    return this.hint() ? `${this.id}-hint` : null;
  }
}