import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, PASSWORD_VALIDATORS, apiError } from '../core/auth.service';
import { AuthShell } from '../core/auth-shell';
import { Field } from '../core/field';
import { Lockout, createCountdown } from '../core/lockout';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-change-password',
  imports: [ReactiveFormsModule, AuthShell, Field, Lockout],
  template: `
    <app-auth-shell>
      <form class="form" [formGroup]="form" (ngSubmit)="submit()">
        <div>
          <h1>Cambia tu contraseña</h1>
          <p class="sub">
            {{ forced() ? 'Por seguridad, crea una contraseña propia antes de continuar.' : 'Elige una contraseña nueva.' }}
          </p>
        </div>
        <app-field label="Contraseña actual" type="password" autocomplete="current-password" [control]="form.controls.current" />
        <app-field label="Contraseña nueva" type="password" autocomplete="new-password"
          hint="Mínimo 10 caracteres, con letras y números" [control]="form.controls.next" />
        <app-field label="Repite la contraseña nueva" type="password" autocomplete="new-password" [control]="form.controls.confirm" />
        <app-lockout [cd]="lock" />
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <button class="btn" [attr.aria-busy]="loading()" [disabled]="loading() || lock.active()">
          {{ loading() ? 'Guardando…' : 'Guardar contraseña' }}
        </button>
        @if (forced()) {
          <button type="button" class="btn secondary" (click)="auth.logout()">Cerrar sesión</button>
        } @else {
          <button type="button" class="btn secondary" (click)="back()">Cancelar</button>
        }
      </form>
    </app-auth-shell>
  `
})
export class ChangePasswordPage {
  auth = inject(AuthService);
  private fb = inject(NonNullableFormBuilder);
  private router = inject(Router);
  private toast = inject(ToastService);

  lock = createCountdown();
  form = this.fb.group({
    current: ['', Validators.required],
    next: ['', PASSWORD_VALIDATORS],
    confirm: ['', Validators.required]
  });
  forced = computed(() => this.auth.user()?.mustChangePassword === true);
  loading = signal(false);
  error = signal('');

  back() { this.router.navigateByUrl(this.auth.homeFor(this.auth.user()!.role)); }

  submit() {
    if (this.lock.active()) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const { current, next, confirm } = this.form.getRawValue();
    if (next !== confirm) {
      this.form.controls.confirm.setErrors({ mismatch: true });
      this.form.controls.confirm.markAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.auth.changePassword(current, next).subscribe({
      next: () => {
        this.toast.success('Contraseña actualizada');
        this.back();
      },
      error: (e) => {
        if (e?.status === 429) this.lock.start(e.error?.retryAfter ?? 60);
        else this.error.set(apiError(e));
        this.loading.set(false);
      }
    });
  }
}