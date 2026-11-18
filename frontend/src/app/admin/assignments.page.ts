import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiError } from '../core/auth.service';
import { AdminStore, AdminUser } from '../core/admin-store';
import { StateView } from '../core/state';
import { ToastService } from '../core/toast.service';
import { initialsOf } from '../core/team-store';

@Component({
  selector: 'app-admin-assignments',
  imports: [RouterLink, StateView],
  template: `
    <header class="page-head">
      <h1>Asignaciones</h1>
      <p class="sub">Elige un entrenador para cada deportista. Los cambios se guardan al seleccionar una opción.</p>
    </header>

    @if (store.failed()) {
      <app-state kind="error" title="No pudimos cargar los deportistas"
        text="Revisa tu conexión e inténtalo de nuevo." action="Reintentar" (act)="store.load()" />
    } @else if (store.loading()) {
      <div class="stack" aria-busy="true" aria-label="Cargando">
        <div class="sk sk-row"></div><div class="sk sk-row"></div><div class="sk sk-row"></div>
      </div>
    } @else if (!store.athletes().length) {
      <div class="card">
        <app-state kind="empty" title="Aún no hay deportistas"
          text="Los deportistas aparecen aquí cuando se registran desde la pantalla de acceso." />
      </div>
    } @else {
      @if (!store.coaches().length) {
        <p class="notice" role="note">
          No hay entrenadores activos. <a routerLink="/admin">Crea uno en Usuarios</a> para poder asignarlo.
        </p>
      }

      <div class="chips" role="group" aria-label="Filtrar deportistas">
        <button type="button" class="chip" [class.on]="!onlyFree()" [attr.aria-pressed]="!onlyFree()"
          (click)="onlyFree.set(false)">Todos · {{ store.athletes().length }}</button>
        <button type="button" class="chip" [class.on]="onlyFree()" [attr.aria-pressed]="onlyFree()"
          (click)="onlyFree.set(true)">Sin entrenador · {{ unassigned() }}</button>
      </div>

      @if (shown().length) {
        <p class="results-line" role="status">{{ shown().length }} de {{ store.athletes().length }} deportistas</p>
        <ul class="ath-list">
          @for (a of shown(); track a.id) {
            <li class="arow">
              <span class="avatar" aria-hidden="true">{{ initials(a.fullName) }}</span>
              <span class="ath-name">
                <strong>{{ a.fullName }}</strong>
                <small>{{ a.email }}</small>
              </span>
              <div class="field">
                <label class="sr-only" [attr.for]="'c-' + a.id">Entrenador de {{ a.fullName }}</label>
                <select [id]="'c-' + a.id" [disabled]="saving().has(a.id)" (change)="assign(a, $any($event.target))">
                  <option value="" [selected]="!a.athlete?.coachId">Sin asignar</option>
                  @if (a.athlete?.coachId && !hasActiveCoach(a.athlete!.coachId!)) {
                    <option [value]="a.athlete!.coachId" selected disabled>Entrenador inactivo</option>
                  }
                  @for (c of store.coaches(); track c.id) {
                    <option [value]="c.id" [selected]="a.athlete?.coachId === c.id">{{ c.fullName }}</option>
                  }
                </select>
              </div>
            </li>
          }
        </ul>
      } @else {
        <div class="card">
          <app-state kind="success" title="Todos tienen entrenador" text="No hay deportistas sin asignar." />
        </div>
      }
    }
  `
})
export class AdminAssignmentsPage {
  store = inject(AdminStore);
  private toast = inject(ToastService);

  onlyFree = signal(false);
  unassigned = computed(() => this.store.athletes().filter((a) => !a.athlete?.coachId).length);
  shown = computed(() =>
    this.store.athletes().filter((a) => !this.onlyFree() || !a.athlete?.coachId)
  );

  initials = initialsOf;

  saving = signal<ReadonlySet<string>>(new Set());

  hasActiveCoach(id: string) { return this.store.coaches().some(coach => coach.id === id); }

  assign(a: AdminUser, select: HTMLSelectElement) {
    if (!a.athlete || this.saving().has(a.id)) return;
    this.saving.update(ids => new Set(ids).add(a.id));
    const finish = () => this.saving.update(ids => new Set([...ids].filter(id => id !== a.id)));
    this.store.setCoach(a.athlete.id, select.value || null).subscribe({
      next: () => { finish(); this.toast.success('Asignación guardada'); },
      error: e => { select.value = a.athlete?.coachId ?? ''; finish(); this.toast.error(apiError(e)); }
    });
  }
}
