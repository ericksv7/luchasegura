import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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
      <p class="sub">Define qué entrenador sigue a cada deportista. {{ unassigned() }} sin entrenador.</p>
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
                <select [id]="'c-' + a.id" (change)="assign(a, $any($event.target).value)">
                  <option value="" [selected]="!a.athlete?.coachId">Sin asignar</option>
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

  assign(a: AdminUser, coachId: string) {
    if (!a.athlete) return;
    this.store.setCoach(a.athlete.id, coachId || null, (msg) => this.toast.error(msg));
    this.toast.success('Asignación guardada');
  }
}