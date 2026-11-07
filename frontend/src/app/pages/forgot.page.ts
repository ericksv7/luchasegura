import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService, apiError } from '../core/auth.service';
import { AuthShell } from '../core/auth-shell';
import { Field } from '../core/field';
import { StateView } from '../core/state';

@Component({
  selector: 'app-forgot',
  imports: [ReactiveFormsModule, RouterLink, AuthShell, Field, StateView],
  template: `
    <app-auth-shell>
      @if (sent()) {
        <app-state
          kind="success"
          title="Revisa tu correo"
          [text]="'Si ' + form.controls.email.value + ' está registrado, te enviamos un enlace para crear una contraseña nueva. Vence en 30 minutos.'" />
        <p class="alt"><a routerLink="/login">Volver a iniciar sesión</a></p>
      } @else {
        <form class="form" [formGroup]="form" (ngSubmit)="submit()">
          <div>
            <h1>Recuperar contraseña</h1>
            <p class="sub">Escribe tu correo y te enviaremos un enlace para crear una nueva.</p>
          </div>
          <app-field label="Correo" type="email" autocomplete="username" [control]="form.controls.email" />
          @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
          <button class="btn" [attr.aria-busy]="loading()" [disabled]="loading()">
            {{ loading() ? 'Enviando…' : 'Enviar enlace' }}
          </button>
          <p class="alt"><a routerLink="/login">Volver a iniciar sesión</a></p>
        </form>
      }
    </app-auth-shell>
  `
})
export class ForgotPage {
  private fb = inject(NonNullableFormBuilder);
  private auth = inject(AuthService);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });
  loading = signal(false);
  error = signal('');
  sent = signal(false);

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');
    this.auth.forgotPassword(this.form.getRawValue().email).subscribe({
      next: () => { this.sent.set(true); this.loading.set(false); },
      error: (e) => { this.error.set(apiError(e)); this.loading.set(false); }
    });
  }
}