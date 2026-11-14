import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService, apiError } from '../core/auth.service';
import { ZONES } from '../core/athlete-store';
import { StateView } from '../core/state';
import { ToastService } from '../core/toast.service';
import { confirmDialog } from '../core/confirm';

interface Rule { id: string; bodyZone: string | null; minIntensity: number; }

@Component({
  selector: 'app-team-rules',
  imports: [StateView],
  template: `
    <header class="page-head">
      <h1>Umbrales de alerta</h1>
      <p class="sub">Cuándo un reporte de dolor genera una alerta para el equipo.</p>
    </header>

    @if (failed()) {
      <app-state kind="error" title="No pudimos cargar los umbrales"
        text="Revisa tu conexión e inténtalo de nuevo." action="Reintentar" (act)="load()" />
    } @else if (loading()) {
      <div class="cards" aria-busy="true" aria-label="Cargando">
        <div class="sk sk-chart"></div><div class="sk sk-chart"></div>
      </div>
    } @else {
      <div class="cards">
        <section class="card" aria-labelledby="r-list">
          <h2 id="r-list">Reglas actuales</h2>
          @if (sorted().length) {
            <ul class="list">
              @for (r of sorted(); track r.id) {
                <li>
                  <div>
                    <strong>{{ r.bodyZone ?? 'Todas las zonas' }}</strong>
                    <small>Alerta desde {{ r.minIntensity }} de 10</small>
                  </div>
                  @if (canEdit) {
                    <button type="button" class="icon-btn sm"
                      [attr.aria-label]="'Eliminar la regla de ' + (r.bodyZone ?? 'todas las zonas')" (click)="remove(r)">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                    </button>
                  }
                </li>
              }
            </ul>
            <p class="note">Si una zona tiene su propia regla, esa manda. Si no, se usa la de «Todas las zonas».</p>
          } @else {
            <app-state kind="empty" title="Sin umbrales definidos"
              text="Mientras no haya un umbral, ningún reporte genera alertas." />
          }
        </section>

        @if (canEdit) {
          <form class="card form" (ngSubmit)="save()">
            <h2>Agregar o cambiar un umbral</h2>
            <div class="field">
              <label for="r-zone">Zona</label>
              <select id="r-zone" (change)="zone.set($any($event.target).value)">
                <option value="" [selected]="zone() === ''">Todas las zonas</option>
                @for (z of zones; track z) { <option [value]="z" [selected]="zone() === z">{{ z }}</option> }
              </select>
            </div>
            <div class="field">
              <label for="r-min">Alertar desde</label>
              <select id="r-min" (change)="min.set(+$any($event.target).value)">
                @for (n of levels; track n) { <option [value]="n" [selected]="min() === n">{{ n }} de 10</option> }
              </select>
            </div>
            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
            <button class="btn" [attr.aria-busy]="saving()" [disabled]="saving()">
              {{ saving() ? 'Guardando…' : 'Guardar umbral' }}
            </button>
            <p class="note">Si ya existe una regla para esa zona, se reemplaza.</p>
          </form>
        } @else {
          <section class="card">
            <h2>Solo lectura</h2>
            <p class="meta">Solo el fisioterapeuta puede cambiar los umbrales.</p>
          </section>
        }
      </div>
    }
  `
})
export class TeamRulesPage {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private auth = inject(AuthService);

  zones = ZONES;
  levels = Array.from({ length: 10 }, (_, i) => i + 1);
  canEdit = this.auth.user()?.role === 'PHYSIO';

  rules = signal<Rule[]>([]);
  loading = signal(true);
  failed = signal(false);
  zone = signal('');
  min = signal(5);
  saving = signal(false);
  error = signal('');

  sorted = computed(() => [...this.rules()].sort((a, b) => (a.bodyZone ?? '').localeCompare(b.bodyZone ?? '')));

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.failed.set(false);
    this.http.get<Rule[]>('/api/rules').subscribe({
      next: (r) => { this.rules.set(r); this.loading.set(false); },
      error: () => { this.failed.set(true); this.loading.set(false); }
    });
  }

  save() {
    this.saving.set(true);
    this.error.set('');
    this.http.post<Rule>('/api/rules', { bodyZone: this.zone() || null, minIntensity: this.min() }).subscribe({
      next: (rule) => {
        this.rules.update((list) => (list.some((r) => r.id === rule.id) ? list.map((r) => (r.id === rule.id ? rule : r)) : [...list, rule]));
        this.toast.success('Umbral guardado');
        this.saving.set(false);
      },
      error: (e) => { this.error.set(apiError(e)); this.saving.set(false); }
    });
  }

  async remove(r: Rule) {
    const ok = await confirmDialog({
      title: '¿Eliminar esta regla?',
      text: `${r.bodyZone ?? 'Todas las zonas'}: alerta desde ${r.minIntensity} de 10.`,
      confirmText: 'Eliminar',
      danger: true
    });
    if (!ok) return;
    this.http.delete(`/api/rules/${r.id}`).subscribe({
      next: () => {
        this.rules.update((list) => list.filter((x) => x.id !== r.id));
        this.toast.success('Regla eliminada');
      },
      error: (e) => this.toast.error(apiError(e))
    });
  }
}