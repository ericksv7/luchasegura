import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { AuthService, apiError } from '../core/auth.service';
import { AuthShell } from '../core/auth-shell';
import { Field } from '../core/field';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, AuthShell, Field],
  template: `
    <app-auth-shell>
      <form class="form" [formGroup]="form" (ngSubmit)="submit()">
        <div>
          <h1>Crear cuenta</h1>
          <p class="sub">Registro para deportistas.</p>
        </div>
        <app-field label="Nombre completo" autocomplete="name" [control]="form.controls.fullName" />
        <app-field label="Correo" type="email" autocomplete="username" [control]="form.controls.email" />
        <app-field label="Contraseña" type="password" autocomplete="new-password"
          hint="Mínimo 8 caracteres" [control]="form.controls.password" />
        <app-field label="Nombre del acudiente (opcional)"
          hint="Solo si eres menor de 18 años" [control]="form.controls.guardianName" />
        <div class="field">
          <label class="check">
            <input type="checkbox" formControlName="consent" [attr.aria-invalid]="consentError ? 'true' : null" />
            <span>Acepto el consentimiento informado para el uso de mis datos en el proyecto (texto en borrador).</span>
          </label>
          @if (consentError) { <small class="msg" role="alert">Debes aceptar el consentimiento para continuar</small> }
        </div>
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <button class="btn" [attr.aria-busy]="loading()" [disabled]="loading()">
          {{ loading() ? 'Creando…' : 'Crear cuenta' }}
        </button>
        <p class="alt">¿Ya tienes cuenta? <a routerLink="/login">Iniciar sesión</a></p>
      </form>
    </app-auth-shell>
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

  get consentError() {
    const c = this.form.controls.consent;
    return c.invalid && c.touched;
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
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