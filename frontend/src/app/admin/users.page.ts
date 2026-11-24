import { afterNextRender, Component, computed, ElementRef, inject, Injector, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService, Role, apiError } from '../core/auth.service';
import { AdminStore, AdminUser, NewUserRole, ROLE_LABEL } from '../core/admin-store';
import { Field } from '../core/field';
import { StateView } from '../core/state';
import { ToastService } from '../core/toast.service';
import { confirmDialog } from '../core/confirm';
import { initialsOf } from '../core/team-store';
import { DelBtn } from '../core/del-btn';
import { EditBtn } from '../core/edit-btn';
import { ActiveBtn } from '../core/active-btn';

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

@Component({
  selector: 'app-admin-users',
  imports: [ReactiveFormsModule, Field, StateView, DelBtn, ActiveBtn, EditBtn],
  template: `
    <header class="page-head head-row">
      <div>
        <h1>Usuarios</h1>
        <p class="sub">Gestiona el acceso del personal y consulta el estado de las cuentas.</p>
      </div>
      @if (!open() && !created() && !store.loading() && !store.failed()) {
        <button type="button" class="btn" (click)="newUser()">Nuevo usuario</button>
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
        <h2 id="h-new" #formTitle tabindex="-1">{{ edited() ? 'Editar usuario' : 'Nuevo usuario' }}</h2>
        <p class="meta">Todos los campos de este formulario son obligatorios.</p>
        <app-field label="Nombre completo" autocomplete="off" [control]="form.controls.fullName" />
        <app-field label="Correo" type="email" autocomplete="off" [control]="form.controls.email" />
        @if (canSetRole()) { <fieldset class="group">
          <legend>Rol</legend>
          <div class="chips">
            @for (r of newRoles; track r.v) {
              <button type="button" class="chip" [class.on]="newRole() === r.v" [attr.aria-pressed]="newRole() === r.v"
                (click)="newRole.set(r.v)">{{ r.label }}</button>
            }
          </div>
        </fieldset> }
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <div class="actions form-actions">
          <button type="button" class="btn tertiary" [disabled]="saving()" (click)="cancel()">Cancelar</button>
          <button class="btn" [attr.aria-busy]="saving()" [disabled]="saving()">{{ saving() ? 'Guardando…' : edited() ? 'Guardar cambios' : 'Crear usuario' }}</button>
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
        <p class="results-line" role="status">{{ filtered().length }} de {{ store.users().length }} cuentas</p>
        <ul class="ath-list user-directory">
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
                  <span class="action-slot" data-action="Editar"><button appEdit [label]="'Editar a ' + u.fullName" (click)="edit(u)"></button></span>
                  <span class="action-slot" [attr.data-action]="u.active ? 'Desactivar' : 'Activar'"><button appActive [active]="u.active" [userName]="u.fullName" [disabled]="updating().has(u.id)" (click)="toggle(u)"></button></span>
                  @if (u.role !== 'ATHLETE') {
                    <span class="action-slot" data-action="Eliminar"><button appDel [label]="'Eliminar a ' + u.fullName" (click)="remove(u)"></button></span>
                  }
                </span>
              } @else {
                <span class="acts act"><span class="you">Tu cuenta</span><span class="action-slot" data-action="Editar"><button appEdit [label]="'Editar a ' + u.fullName" (click)="edit(u)"></button></span></span>
              }
            </li>
          }
        </ul>
      } @else {
        <div class="card">
          <app-state kind="empty" title="Sin resultados" text="Prueba con otro nombre o correo, o cambia el rol seleccionado." action="Limpiar filtros" (act)="q.set(''); filter.set('all')" />
        </div>
      }
    }
  `,
  styles: [`
    .user-directory { gap: 0; background: var(--surf); border: 1px solid var(--line); border-radius: var(--r-lg); }
    .user-directory .urow { border: 0; border-radius: 0; background: transparent; }
    .user-directory .urow + .urow { border-block-start: 1px solid var(--line); }
    .user-directory .urow .acts { align-self: center; }
  `],
})
export class AdminUsersPage {
  store = inject(AdminStore);
  private auth = inject(AuthService);
  private fb = inject(NonNullableFormBuilder);
  private toast = inject(ToastService);
  private injector = inject(Injector);
  private formTitle = viewChild<ElementRef<HTMLElement>>('formTitle');

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
  edited = signal<AdminUser | null>(null);
  updating = signal<ReadonlySet<string>>(new Set());
  canSetRole = computed(() => {
    const user = this.edited();
    return !user || (user.role !== 'ATHLETE' && user.id !== this.me() && !this.store.athletes().some(a => a.athlete?.coachId === user.id));
  });
  saving = signal(false);
  error = signal('');
  newRole = signal<NewUserRole>('COACH');
  created = signal<{ name: string; email: string; password: string } | null>(null);

  form = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
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

  newUser() {
    this.cancel();
    this.newRole.set('COACH');
    this.showForm();
  }

  edit(user: AdminUser) {
    if (this.saving()) return;
    this.edited.set(user);
    this.form.reset({ fullName: user.fullName, email: user.email });
    if (user.role !== 'ATHLETE') this.newRole.set(user.role);
    this.error.set('');
    this.showForm();
  }

  private showForm() {
    this.open.set(true);
    afterNextRender(() => this.formTitle()?.nativeElement.focus(), { injector: this.injector });
  }

  cancel() {
    this.edited.set(null);
    this.open.set(false);
    this.error.set('');
    this.form.reset();
  }

  submit() {
    if (this.saving()) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set('');
    const body = { fullName: v.fullName.trim(), email: v.email.trim() };
    const edited = this.edited();
    if (edited) {
      this.store.update(edited.id, { ...body, ...(this.canSetRole() ? { role: this.newRole() } : {}) }).subscribe({
        next: () => { this.toast.success('Usuario actualizado'); this.cancel(); this.saving.set(false); },
        error: e => { this.error.set(apiError(e)); this.saving.set(false); }
      });
      return;
    }
    this.store.create({ ...body, role: this.newRole() }).subscribe({
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
    if (this.updating().has(u.id)) return;
    this.updating.update(ids => new Set(ids).add(u.id));
    const finish = () => this.updating.update(ids => new Set([...ids].filter(id => id !== u.id)));
    this.store.update(u.id, { active: !wasActive }).subscribe({
      next: () => { finish(); this.toast.success(wasActive ? 'Usuario desactivado' : 'Usuario activado'); },
      error: e => { finish(); this.toast.error(apiError(e)); }
    });
  }

  async remove(u: AdminUser) {
    const ok = await confirmDialog({
      title: `¿Eliminar a ${u.fullName}?`,
      text: 'Solo pueden eliminarse cuentas sin registros protegidos. Si necesitas conservar la cuenta, puedes desactivarla.',
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
