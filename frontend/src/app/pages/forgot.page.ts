import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService, apiError } from '../core/auth.service';
import { AuthShell } from '../core/auth-shell';
import { Field } from '../core/field';
import { Lockout, createCountdown } from '../core/lockout';

@Component({
  selector: 'app-forgot',
  imports: [ReactiveFormsModule, RouterLink, AuthShell, Field, Lockout],
  template: `
    <app-auth-shell>
      <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div>
          <h1>Recuperar contraseña</h1>
          <p class="sub">Introduce el correo que registraste en LuchaSegura.</p>
        </div>
        <app-field label="Correo" type="email" autocomplete="email" [control]="form.controls.email" />
        <app-lockout [cd]="lock" />
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        @if (requested()) {
          <p class="notice" role="status">Si la cuenta puede usar la recuperación, recibirás instrucciones por correo. Revisa también la carpeta de correo no deseado.</p>
        }
        <button class="btn" [attr.aria-busy]="loading()" [disabled]="loading() || lock.active()">
          {{ loading() ? 'Solicitando…' : 'Enviar instrucciones' }}
        </button>
        <a routerLink="/login">Volver a iniciar sesión</a>
      </form>
    </app-auth-shell>
  `
})
export class ForgotPage {
  private auth = inject(AuthService);
  form = inject(NonNullableFormBuilder).group({ email: ['', [Validators.required, Validators.email]] });
  lock = createCountdown();
  loading = signal(false);
  requested = signal(false);
  error = signal('');

  submit() {
    if (this.loading() || this.lock.active()) return;
    this.requested.set(false);
    this.error.set('');
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.loading.set(true);
    this.auth.forgotPassword(this.form.getRawValue().email).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: () => this.requested.set(true),
      error: error => {
        if (error?.status === 429) this.lock.start(error.error?.retryAfter ?? 60);
        else this.error.set(apiError(error));
      },
    });
  }
}
