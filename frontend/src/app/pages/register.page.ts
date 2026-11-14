import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { AuthService, PASSWORD_VALIDATORS, apiError } from '../core/auth.service';
import { AuthShell } from '../core/auth-shell';
import { Field } from '../core/field';
import { Lockout, createCountdown } from '../core/lockout';
import { ToastService } from '../core/toast.service';
import { ageOf, birthDateValidator } from '../core/age';
import { CONSENT_TEXT, CONSENT_VERSION } from '../core/consent';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, AuthShell, Field, Lockout],
  template: `
    <app-auth-shell>
      <form class="form" [formGroup]="form" (ngSubmit)="submit()">
        <div>
          <h1>Crear cuenta</h1>
          <p class="sub">Registro para deportistas.</p>
        </div>
        <app-field label="Nombre completo" autocomplete="name" [control]="form.controls.fullName" />
        <app-field label="Correo" type="email" autocomplete="username" [control]="form.controls.email" />
        <app-field label="Fecha de nacimiento" type="date" autocomplete="bday" [max]="today" [control]="form.controls.birthDate" />
        <app-field label="Contraseña" type="password" autocomplete="new-password"
          hint="Mínimo 10 caracteres, con letras y números" [control]="form.controls.password" />
        @if (isMinor) {
          <app-field label="Nombre del acudiente" hint="Obligatorio para menores de 18 años"
            [control]="form.controls.guardianName" />
        }

        <details class="consent-box">
          <summary>Leer el consentimiento informado</summary>
          @for (p of consentText; track $index) { <p>{{ p }}</p> }
          <p class="draft">Texto en borrador, pendiente de aprobación por la universidad y el IDRD.</p>
        </details>
        <div class="field">
          <label class="check">
            <input type="checkbox" formControlName="consent" [attr.aria-invalid]="consentError ? 'true' : null" />
            <span>He leído y acepto el consentimiento informado{{ isMinor ? ', con autorización de mi acudiente' : '' }}.</span>
          </label>
          @if (consentError) { <small class="msg" role="alert">Debes aceptar el consentimiento para continuar</small> }
        </div>

        <app-lockout [cd]="lock" />
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <button class="btn" [attr.aria-busy]="loading()" [disabled]="loading() || lock.active()">
          {{ loading() ? 'Creando cuenta…' : 'Crear cuenta' }}
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
  private toast = inject(ToastService);

  lock = createCountdown();
  consentText = CONSENT_TEXT;
  today = new Date().toISOString().slice(0, 10);

  form = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    birthDate: ['', [Validators.required, birthDateValidator]],
    password: ['', PASSWORD_VALIDATORS],
    guardianName: [''],
    consent: [false, Validators.requiredTrue]
  });
  loading = signal(false);
  error = signal('');

  constructor() {
    this.form.controls.birthDate.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.syncGuardian());
  }

  get isMinor() {
    const a = ageOf(this.form.controls.birthDate.value);
    return a !== null && a >= 0 && a < 18;
  }

  get consentError() {
    const c = this.form.controls.consent;
    return c.invalid && c.touched;
  }

  // El acudiente solo es obligatorio si es menor de edad
  private syncGuardian() {
    const g = this.form.controls.guardianName;
    if (this.isMinor) g.setValidators([Validators.required, Validators.minLength(3)]);
    else g.clearValidators();
    g.updateValueAndValidity({ emitEvent: false });
  }

  submit() {
    if (this.lock.active()) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    this.loading.set(true);
    this.error.set('');
    this.auth
      .register({
        email: v.email,
        password: v.password,
        fullName: v.fullName,
        birthDate: v.birthDate,
        consent: {
          textVersion: CONSENT_VERSION,
          guardianName: this.isMinor ? v.guardianName.trim() : undefined
        }
      })
      .pipe(switchMap(() => this.auth.login(v.email, v.password)))
      .subscribe({
        next: () => {
          this.toast.success('Cuenta creada. ¡Bienvenido!');
          this.router.navigateByUrl(this.auth.homeFor(this.auth.user()!.role));
        },
        error: (e) => {
          if (e?.status === 429) this.lock.start(e.error?.retryAfter ?? 60);
          else this.error.set(apiError(e));
          this.loading.set(false);
        }
      });
  }
}