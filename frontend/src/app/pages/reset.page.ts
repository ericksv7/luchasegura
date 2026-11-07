import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, apiError } from '../core/auth.service';
import { AuthShell } from '../core/auth-shell';
import { Field } from '../core/field';
import { StateView } from '../core/state';

@Component({
  selector: 'app-reset',
  imports: [ReactiveFormsModule, AuthShell, Field, StateView],
  template: `
    <app-auth-shell>
      @switch (status()) {
        @case ('checking') {
          <div class="form" aria-busy="true">
            <div>
              <h1>Nueva contraseña</h1>
              <p class="sub sk">Elige una contraseña que no uses en otros sitios.</p>
            </div>
            <div class="field"><span class="sk">Nueva contraseña</span><div class="sk sk-input"></div></div>
            <div class="field"><span class="sk">Repite la contraseña</span><div class="sk sk-input"></div></div>
            <div class="sk sk-input"></div>
          </div>
        }
        @case ('done') {
          <app-state kind="success" title="Contraseña actualizada" text="Ya puedes iniciar sesión con tu nueva contraseña."
            action="Ir a iniciar sesión" (act)="go('/login')" />
        }
        @case ('invalid') {
          <app-state kind="error" title="Enlace no válido" text="El enlace no es válido o ya venció. Solicita uno nuevo."
            action="Solicitar nuevo enlace" (act)="go('/olvide-contrasena')" />
        }
        @default {
          <form class="form" [formGroup]="form" (ngSubmit)="submit()">
            <div>
              <h1>Nueva contraseña</h1>
              <p class="sub">Elige una contraseña que no uses en otros sitios.</p>
            </div>
            <app-field label="Nueva contraseña" type="password" autocomplete="new-password"
              hint="Mínimo 8 caracteres" [control]="form.controls.password" />
            <app-field label="Repite la contraseña" type="password" autocomplete="new-password"
              [control]="form.controls.confirm" />
            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
            <button class="btn" [attr.aria-busy]="loading()" [disabled]="loading()">
              {{ loading() ? 'Guardando…' : 'Guardar contraseña' }}
            </button>
          </form>
        }
      }
    </app-auth-shell>
  `
})
export class ResetPage {
  private fb = inject(NonNullableFormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';

  form = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', Validators.required]
  });
  status = signal<'checking' | 'form' | 'done' | 'invalid'>('checking');
  loading = signal(false);
  error = signal('');

  constructor() {
    if (this.token.length < 32) {
      this.status.set('invalid');
      return;
    }
    this.auth.checkResetToken(this.token).subscribe({
      next: (r) => this.status.set(r.valid ? 'form' : 'invalid'),
      // Si no se pudo comprobar, muestra el formulario: el envío vuelve a validar
      error: () => this.status.set('form')
    });
  }

  go(path: string) { this.router.navigateByUrl(path); }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const { password, confirm } = this.form.getRawValue();
    if (password !== confirm) {
      this.form.controls.confirm.setErrors({ mismatch: true });
      this.form.controls.confirm.markAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.auth.resetPassword(this.token, password).subscribe({
      next: () => this.status.set('done'),
      error: (e) => {
        if (e?.status === 400) this.status.set('invalid');
        else this.error.set(apiError(e));
        this.loading.set(false);
      }
    });
  }
}