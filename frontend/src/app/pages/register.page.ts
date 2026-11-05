import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { AuthService, apiError } from '../core/auth.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <main class="auth">
      <form class="auth-card" [formGroup]="form" (ngSubmit)="submit()">
        <h1>Crear cuenta</h1>
        <p>Registro de deportistas</p>
        <label class="field">Nombre completo
          <input type="text" formControlName="fullName" autocomplete="name" />
        </label>
        <label class="field">Correo
          <input type="email" formControlName="email" autocomplete="username" />
        </label>
        <label class="field">Contraseña (mínimo 8 caracteres)
          <input type="password" formControlName="password" autocomplete="new-password" />
        </label>
        <label class="field">Nombre del acudiente (si eres menor de 18 años)
          <input type="text" formControlName="guardianName" />
        </label>
        <label class="check">
          <input type="checkbox" formControlName="consent" />
          <span>Acepto el consentimiento informado para el uso de mis datos en el proyecto (texto en borrador).</span>
        </label>
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <button class="btn" [disabled]="form.invalid || loading()">
          {{ loading() ? 'Creando…' : 'Crear cuenta' }}
        </button>
        <p class="alt">¿Ya tienes cuenta? <a routerLink="/login">Iniciar sesión</a></p>
      </form>
    </main>
  `
})
export class RegisterPage {
  private fb = inject(NonNullableFormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  form = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    guardianName: [''],
    consent: [false, Validators.requiredTrue]
  });
  loading = signal(false);
  error = signal('');

  submit() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.loading.set(true);
    this.error.set('');
    this.auth
      .register({
        email: v.email,
        password: v.password,
        fullName: v.fullName,
        consent: { textVersion: 'v0-borrador', guardianName: v.guardianName || undefined }
      })
      .pipe(switchMap(() => this.auth.login(v.email, v.password)))
      .subscribe({
        next: () => this.router.navigateByUrl(this.auth.homeFor(this.auth.user()!.role)),
        error: (e) => { this.error.set(apiError(e)); this.loading.set(false); }
      });
  }
}