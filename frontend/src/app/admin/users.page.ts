import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService, Role, apiError } from '../core/auth.service';
import { AdminStore, AdminUser, NewUserRole, ROLE_LABEL } from '../core/admin-store';
import { Field } from '../core/field';
import { StateView } from '../core/state';
import { ToastService } from '../core/toast.service';
import { confirmDialog } from '../core/confirm';
import { initialsOf } from '../core/team-store';

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

@Component({
  selector: 'app-admin-users',
  imports: [ReactiveFormsModule, Field, StateView],
  template: `
    <header class="page-head head-row">
      <div>
        <h1>Usuarios</h1>
        <p class="sub">{{ store.users().length }} cuentas en el sistema</p>
      </div>
      @if (!open() && !created()) {
        <button type="button" class="btn sm" (click)="open.set(true)">Nuevo usuario</button>
      }
    </header>

    @if (created(); as c) {
      <section class="card secret-card section-sm" role="status" aria-labelledby="h-cred">
        <h2 id="h-cred">Usuario creado: {{ c.name }}</h2>
        <p class="meta">Comparte estos datos de forma segura. La contraseña se muestra una sola vez.</p>
        <dl class="rows">
          <div><dt>Correo</dt><dd>{{ c.email }}</dd></div>
          <div><dt>Contraseña temporal</dt><dd><code class="secret">{{ c.password }}</code></dd></div>
        </dl>
        <p class="note">Al iniciar sesión por primera vez, el sistema le pedirá crear una contraseña propia.</p>
        <div class="actions">
          <button type="button" class="btn secondary" (click)="copy(c.password)">Copiar contraseña</button>
          <button type="button" class="btn" (click)="created.set(null)">Listo</button>
        </div>
      </section>
    }

    @if (open()) {
      <form class="card form section-sm" [formGroup]="form" (ngSubmit)="submit()" aria-labelledby="h-new">
        <h2 id="h-new">Nuevo usuario</h2>
        <app-field label="Nombre completo" autocomplete="off" [control]="form.controls.fullName" />
        <app-field label="Correo" type="email" autocomplete="off" [control]="form.controls.email" />
        <fieldset class="group">
          <legend>Rol</legend>
          <div class="chips">
            @for (r of newRoles; track r.v) {
              <button type="button" class="chip" [class.on]="newRole() === r.v" [attr.aria-pressed]="newRole() === r.v"
                (click)="newRole.set(r.v)">{{ r.label }}</button>
            }
          </div>
        </fieldset>
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <div class="actions">
          <button type="button" class="btn secondary" (click)="cancel()">Cancelar</button>
          <button class="btn" [attr.aria-busy]="saving()" [disabled]="saving()">{{ saving() ? 'Creando…' : 'Crear usuario' }}</button>
        </div>
      </form>
    }

    @if (store.failed()) {
      <app-state kind="error" title="No pudimos cargar los usuarios"
        text="Revisa tu conexión e inténtalo de nuevo." action="Reintentar" (act)="store.load()" />
    } @else if (store.loading()) {
      <div class="stack" aria-busy="true" aria-label="Cargando">
        <div class="sk sk-ath"></div><div class="sk sk-ath"></div><div class="sk sk-ath"></div>
      </div>
    } @else {
      <div class="toolbar">
        <div class="field">
          <label for="u-q">Buscar usuario</label>
          <input id="u-q" type="search" placeholder="Nombre o correo" [value]="q()" (input)="q.set($any($event.target).value)" />
        </div>
        <div class="chips" role="group" aria-label="Filtrar por rol">
          @for (f of filters; track f.v) {
            <button type="button" class="chip" [class.on]="filter() === f.v" [attr.aria-pressed]="filter() === f.v"
              (click)="filter.set(f.v)">{{ f.label }} · {{ count(f.v) }}</button>
          }
        </div>
      </div>

      @if (filtered().length) {
        <ul class="ath-list">
          @for (u of filtered(); track u.id) {
            <li class="urow" [class.off]="!u.active">
              <span class="avatar" aria-hidden="true">{{ initials(u.fullName) }}</span>
              <span class="ath-name">
                <strong>{{ u.fullName }}</strong>
                <small>{{ u.email }}</small>
              </span>
              <span class="urow-meta">
                {{ roleLabel(u.role) }}
                <span [class]="'badge ' + (u.active ? 'low' : 'mid')">{{ u.active ? 'Activo' : 'Inactivo' }}</span>
              </span>
              @if (u.id !== me()) {
                <span class="acts act">
                  <button type="button" class="btn secondary sm" (click)="toggle(u)"
                    [attr.aria-label]="(u.active ? 'Desactivar a ' : 'Activar a ') + u.fullName">
                    {{ u.active ? 'Desactivar' : 'Activar' }}
                  </button>
                  <button type="button" class="btn secondary sm danger-text" (click)="remove(u)"
                    [attr.aria-label]="'Eliminar a ' + u.fullName">Eliminar</button>
                </span>
              } @else {
                <span class="you act">Tu cuenta</span>
              }
            </li>
          }
        </ul>
      } @else {
        <div class="card">
          <app-state kind="empty" title="Sin resultados" text="Prueba con otro nombre o cambia el filtro." />
        </div>
      }
    }
  `
})
export class AdminUsersPage {
  store = inject(AdminStore);
  private auth = inject(AuthService);
  private fb = inject(NonNullableFormBuilder);
  private toast = inject(ToastService);

  me = computed(() => this.auth.user()?.id);
  q = signal('');
  filter = signal<'all' | Role>('all');
  filters: { v: 'all' | Role; label: string }[] = [
    { v: 'all', label: 'Todos' },
    { v: 'ATHLETE', label: 'Deportistas' },
    { v: 'COACH', label: 'Entrenadores' },
    { v: 'PHYSIO', label: 'Fisioterapeutas' },
    { v: 'ADMIN', label: 'Administradores' }
  ];
  newRoles: { v: NewUserRole; label: string }[] = [
    { v: 'COACH', label: 'Entrenador' },
    { v: 'PHYSIO', label: 'Fisioterapeuta' },
    { v: 'ADMIN', label: 'Administrador' }
  ];

  open = signal(false);
  saving = signal(false);
  error = signal('');
  newRole = signal<NewUserRole>('COACH');
  created = signal<{ name: string; email: string; password: string } | null>(null);

  form = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]]
  });

  filtered = computed(() => {
    const q = norm(this.q().trim());
    const f = this.filter();
    return this.store
      .users()
      .filter((u) => (f === 'all' || u.role === f) && (!q || norm(u.fullName).includes(q) || norm(u.email).includes(q)));
  });

  initials = initialsOf;
  roleLabel(r: Role) { return ROLE_LABEL[r]; }
  count(f: 'all' | Role) {
    return f === 'all' ? this.store.users().length : this.store.users().filter((u) => u.role === f).length;
  }

  cancel() {
    this.open.set(false);
    this.error.set('');
    this.form.reset();
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set('');
    this.store.create({ fullName: v.fullName.trim(), email: v.email.trim(), role: this.newRole() }).subscribe({
      next: (r) => {
        this.toast.success('Usuario creado');
        this.created.set({ name: r.user.fullName, email: r.user.email, password: r.tempPassword });
        this.cancel();
        this.saving.set(false);
      },
      error: (e) => {
        this.error.set(apiError(e));
        this.saving.set(false);
      }
    });
  }

  async copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success('Contraseña copiada');
    } catch {
      this.toast.error('No se pudo copiar. Selecciónala y cópiala a mano.');
    }
  }

  async toggle(u: AdminUser) {
    const wasActive = u.active;
    if (wasActive) {
      const ok = await confirmDialog({
        title: `¿Desactivar a ${u.fullName}?`,
        text: 'No podrá iniciar sesión hasta que lo actives de nuevo. Sus datos se conservan.',
        confirmText: 'Desactivar',
        danger: true
      });
      if (!ok) return;
    }
    this.store.setActive(u.id, !wasActive, (msg) => this.toast.error(msg));
    this.toast.success(wasActive ? 'Usuario desactivado' : 'Usuario activado');
  }

  async remove(u: AdminUser) {
    const ok = await confirmDialog({
      title: `¿Eliminar a ${u.fullName}?`,
      text: 'Se borrarán de forma permanente su cuenta y todos sus datos. Esta acción no se puede deshacer.',
      confirmText: 'Eliminar',
      danger: true
    });
    if (!ok) return;
    this.store.remove(u.id).subscribe({
      next: () => this.toast.success('Usuario eliminado'),
      error: (e) => this.toast.error(apiError(e))
    });
  }
}