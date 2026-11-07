import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, apiError } from '../core/auth.service';
import { AuthShell } from '../core/auth-shell';
import { Field } from '../core/field';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, AuthShell, Field],
  template: `
    <app-auth-shell>
      <form class="form" [formGroup]="form" (ngSubmit)="submit()">
        <div>
          <h1>Iniciar sesión</h1>
          <p class="sub">Ingresa con tu cuenta para continuar.</p>
        </div>
        <app-field label="Correo" type="email" autocomplete="username" [control]="form.controls.email" />
        <div class="field-group">
          <app-field label="Contraseña" type="password" autocomplete="current-password" [control]="form.controls.password" />
          <a class="forgot" routerLink="/olvide-contrasena">¿Olvidaste tu contraseña?</a>
        </div>
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <button class="btn" [attr.aria-busy]="loading()" [disabled]="loading()">
          {{ loading() ? 'Entrando…' : 'Entrar' }}
        </button>
        <p class="alt">¿Eres deportista y no tienes cuenta? <a routerLink="/registro">Crear cuenta</a></p>
      </form>
    </app-auth-shell>
  `
})
export class LoginPage {
  private fb = inject(NonNullableFormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });
  loading = signal(false);
  error = signal('');

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const { email, password } = this.form.getRawValue();
    this.loading.set(true);
    this.error.set('');
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigateByUrl(this.auth.homeFor(this.auth.user()!.role)),
      error: (e) => { this.error.set(apiError(e)); this.loading.set(false); }
    });
  }
}