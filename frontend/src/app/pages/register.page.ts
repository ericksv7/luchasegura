import { bogotaDay } from '../core/civil-date';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { AuthService, ConsentNotice, PASSWORD_VALIDATORS, apiError } from '../core/auth.service';
import { AuthShell } from '../core/auth-shell';
import { Field } from '../core/field';
import { Lockout, createCountdown } from '../core/lockout';
import { ToastService } from '../core/toast.service';
import { ageOf, birthDateValidator } from '../core/age';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, AuthShell, Field, Lockout],
  template: `
    <app-auth-shell [formFlow]="true">
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
          <app-field label="Nombre del acudiente" hint="Nombre informado por la persona que se registra"
            [control]="form.controls.guardianName" />
        }

        @if (notice(); as document) {
          <details class="disclosure consent-box">
            <summary>Leer el consentimiento informado</summary>
            @for (paragraph of document.paragraphs; track $index) { <p>{{ paragraph }}</p> }
            @if (document.status === 'draft') {
              <p class="draft">Borrador para demostración. Usa únicamente datos ficticios.</p>
            }
          </details>
          @if (document.available) {
            <div class="field">
              <label class="check">
                <input type="checkbox" formControlName="consent" [attr.aria-invalid]="consentError ? 'true' : null"
                  [attr.aria-describedby]="consentError ? 'register-consent-error' : null" />
                <span>He leído y acepto el aviso de esta versión.</span>
              </label>
              @if (consentError) { <small class="msg" role="alert" id="register-consent-error">Debes aceptar el aviso para continuar.</small> }
            </div>
          } @else {
            <p class="notice" role="status">El registro aún no está habilitado en este entorno.</p>
          }
        } @else if (noticeFailed()) {
          <p class="error" role="alert">No pudimos cargar el aviso de consentimiento.</p>
          <button class="btn secondary" type="button" (click)="loadNotice()">Reintentar</button>
        } @else {
          <p class="hint" role="status">Cargando el aviso de consentimiento…</p>
        }

        <app-lockout [cd]="lock" />
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <button class="btn" [attr.aria-busy]="loading()" [disabled]="loading() || lock.active() || !notice()?.available">
          {{ loading() ? 'Creando cuenta…' : 'Crear cuenta' }}
        </button>
        <p class="alt">¿Ya tienes cuenta? <a routerLink="/login">Iniciar sesión</a></p>
      </form>
    </app-auth-shell>
  `,
  styles: [`
    .consent-box { hyphens: auto; }
    .check { min-block-size: 44px; }
  `],
})
export class RegisterPage {
  private fb = inject(NonNullableFormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  lock = createCountdown();
  private destroyRef = inject(DestroyRef);
  notice = signal<ConsentNotice | null>(null);
  noticeFailed = signal(false);
  get today() { return bogotaDay(); }

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
    this.loadNotice();
  }

  loadNotice() {
    this.notice.set(null);
    this.noticeFailed.set(false);
    this.auth.registrationNotice().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: notice => this.notice.set(notice),
      error: () => this.noticeFailed.set(true),
    });
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
    const notice = this.notice();
    if (!notice?.available || this.loading() || this.lock.active()) return;
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
          textVersion: notice.version,
          accepted: true,
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
          else {
            this.error.set(apiError(e));
            if (e?.error?.code === 'CONSENT_VERSION_CHANGED') {
              this.form.controls.consent.reset(false);
              this.loadNotice();
            }
          }
          this.loading.set(false);
        }
      });
  }
}
