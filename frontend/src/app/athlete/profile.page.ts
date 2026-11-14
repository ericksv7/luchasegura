import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService, apiError } from '../core/auth.service';
import { AthleteStore, Injury, ZONES, since } from '../core/athlete-store';
import { confirmDialog } from '../core/confirm';
import { StateView } from '../core/state';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, RouterLink, StateView],
  template: `
    <header class="page-head">
      <h1>Mi perfil</h1>
      <p class="sub">{{ auth.user()?.fullName }}</p>
    </header>

    @if (store.failed()) {
      <app-state kind="error" title="No pudimos cargar tu perfil"
        text="Revisa tu conexión e inténtalo de nuevo." action="Reintentar" (act)="store.load()" />
    } @else if (store.loading()) {
      <div class="cards" aria-busy="true" aria-label="Cargando">
        <div class="sk sk-chart"></div><div class="sk sk-chart"></div>
      </div>
    } @else {
      <div class="cards">
        <section class="card" aria-labelledby="h-datos">
          <div class="card-head">
            <h2 id="h-datos">Datos generales</h2>
            @if (!editing()) { <button type="button" class="btn secondary sm" (click)="edit()">Editar</button> }
          </div>

          @if (editing()) {
            <form class="form" [formGroup]="form" (ngSubmit)="save()">
              <div class="field"><label for="p-birth">Fecha de nacimiento</label><input id="p-birth" type="date" [attr.max]="today" formControlName="birthDate" /></div>
              <div class="field"><label for="p-weight">Peso (kg)</label><input id="p-weight" type="number" step="0.1" min="25" max="200" formControlName="weightKg" /></div>
              <div class="field"><label for="p-cat">Categoría de peso</label><input id="p-cat" type="text" placeholder="Ej. 65 kg" formControlName="category" /></div>
              <div class="field"><label for="p-style">Estilo</label>
                <select id="p-style" formControlName="style">
                  <option value="">Sin elegir</option>
                  <option>Libre</option><option>Grecorromana</option><option>Femenina</option>
                </select>
              </div>
              <div class="field"><label for="p-exp">Años de experiencia</label><input id="p-exp" type="number" min="0" max="50" formControlName="yearsExperience" /></div>
              <div class="field"><label for="p-notes">Observaciones</label><textarea id="p-notes" rows="3" formControlName="notes"></textarea></div>
              @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
              <div class="actions">
                <button type="button" class="btn secondary" (click)="editing.set(false)">Cancelar</button>
                <button class="btn" [attr.aria-busy]="saving()" [disabled]="saving()">{{ saving() ? 'Guardando…' : 'Guardar' }}</button>
              </div>
            </form>
          } @else {
            <dl class="rows">
              <div><dt>Edad</dt><dd>{{ age() !== null ? age() + ' años' : 'Sin registrar' }}</dd></div>
              <div><dt>Peso</dt><dd>{{ store.profile()?.weightKg ? (+store.profile()!.weightKg!) + ' kg' : 'Sin registrar' }}</dd></div>
              <div><dt>Categoría</dt><dd>{{ store.profile()?.category || 'Sin registrar' }}</dd></div>
              <div><dt>Estilo</dt><dd>{{ store.profile()?.style || 'Sin registrar' }}</dd></div>
              <div><dt>Experiencia</dt><dd>{{ store.profile()?.yearsExperience !== null && store.profile()?.yearsExperience !== undefined ? store.profile()!.yearsExperience + ' años' : 'Sin registrar' }}</dd></div>
              @if (store.profile()?.notes) { <div><dt>Observaciones</dt><dd>{{ store.profile()!.notes }}</dd></div> }
            </dl>
          }
        </section>

        <section class="card" aria-labelledby="h-ant">
          <div class="card-head">
            <h2 id="h-ant">Antecedentes de lesión</h2>
            @if (!adding() && store.history().length) {
              <button type="button" class="btn secondary sm" (click)="adding.set(true)">Agregar</button>
            }
          </div>

          @if (adding()) {
            <form class="form" [formGroup]="hxForm" (ngSubmit)="saveHistory()" novalidate>
              <div class="field"><label for="h-zone">Zona del cuerpo</label>
                <select id="h-zone" formControlName="bodyZone" [attr.aria-invalid]="hxForm.controls.bodyZone.touched && hxForm.controls.bodyZone.invalid ? 'true' : null">
                  <option value="">Elige una zona</option>
                  @for (z of zones; track z) { <option [value]="z">{{ z }}</option> }
                </select>
                @if (hxForm.controls.bodyZone.touched && hxForm.controls.bodyZone.invalid) { <small class="msg" role="alert">Elige la zona</small> }
              </div>
              <div class="field"><label for="h-type">Tipo de lesión <span class="opt">(opcional)</span></label><input id="h-type" type="text" placeholder="Ej. esguince" formControlName="injuryType" /></div>
              <div class="field"><label for="h-date">¿Cuándo ocurrió? <span class="opt">(opcional)</span></label><input id="h-date" type="date" [attr.max]="today" formControlName="occurredAt" /></div>
              <div class="field"><label for="h-days">Días sin entrenar <span class="opt">(opcional)</span></label><input id="h-days" type="number" min="0" formControlName="daysAbsent" /></div>
              <label class="check"><input type="checkbox" formControlName="recurrent" /><span>Ha vuelto a ocurrir</span></label>
              @if (hxError()) { <p class="error" role="alert">{{ hxError() }}</p> }
              <div class="actions">
                <button type="button" class="btn secondary" (click)="adding.set(false)">Cancelar</button>
                <button class="btn" [attr.aria-busy]="saving()" [disabled]="saving()">{{ saving() ? 'Guardando…' : 'Guardar' }}</button>
              </div>
            </form>
          } @else if (store.history().length) {
            <ul class="list">
              @for (h of store.history(); track h.id) {
                <li>
                  <div>
                    <strong>{{ h.bodyZone }}{{ h.injuryType ? ' · ' + h.injuryType : '' }}</strong>
                    <small>{{ since(h.occurredAt) }}{{ h.daysAbsent !== null ? ' · ' + h.daysAbsent + ' días sin entrenar' : '' }}</small>
                  </div>
                  <span class="row-actions">
                    @if (h.recurrent) { <span class="badge mid">Recurrente</span> }
                    <button type="button" class="icon-btn sm" [attr.aria-label]="'Eliminar antecedente de ' + h.bodyZone" (click)="removeHistory(h)">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                    </button>
                  </span>
                </li>
              }
            </ul>
          } @else {
            <app-state kind="empty" title="Sin antecedentes registrados"
              text="Si has tenido lesiones antes, agrégalas para que tu equipo las tenga presentes."
              action="Agregar antecedente" (act)="adding.set(true)" />
          }
        </section>

        <div class="span-2 actions">
          <a class="btn secondary" routerLink="/cambiar-contrasena">Cambiar contraseña</a>
          <button type="button" class="btn secondary" (click)="auth.logout()">Cerrar sesión</button>
        </div>
      </div>
    }
  `
})
export class ProfilePage {
  store = inject(AthleteStore);
  auth = inject(AuthService);
  private fb = inject(NonNullableFormBuilder);
  private toast = inject(ToastService);

  zones = ZONES;
  since = since;
  today = new Date().toISOString().slice(0, 10);
  editing = signal(false);
  adding = signal(false);
  saving = signal(false);
  error = signal('');
  hxError = signal('');

  form = this.fb.group({
    birthDate: [''],
    weightKg: this.fb.control<number | null>(null),
    category: [''],
    style: [''],
    yearsExperience: this.fb.control<number | null>(null),
    notes: ['']
  });
  hxForm = this.fb.group({
    bodyZone: ['', Validators.required],
    injuryType: [''],
    occurredAt: [''],
    daysAbsent: this.fb.control<number | null>(null),
    recurrent: [false]
  });

  age = computed(() => {
    const b = this.store.profile()?.birthDate;
    if (!b) return null;
    const d = new Date(b), n = new Date();
    let a = n.getFullYear() - d.getFullYear();
    const m = n.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
    return a;
  });

  edit() {
    const p = this.store.profile();
    this.form.reset({
      birthDate: p?.birthDate ? p.birthDate.slice(0, 10) : '',
      weightKg: p?.weightKg != null ? Number(p.weightKg) : null,
      category: p?.category ?? '',
      style: p?.style ?? '',
      yearsExperience: p?.yearsExperience ?? null,
      notes: p?.notes ?? ''
    });
    this.error.set('');
    this.editing.set(true);
  }

  save() {
    const v = this.form.getRawValue();
    const body: Record<string, unknown> = {};
    if (v.birthDate) body['birthDate'] = v.birthDate;
    if (v.weightKg !== null) body['weightKg'] = v.weightKg;
    if (v.category) body['category'] = v.category;
    if (v.style) body['style'] = v.style;
    if (v.yearsExperience !== null) body['yearsExperience'] = v.yearsExperience;
    if (v.notes) body['notes'] = v.notes;

    this.saving.set(true);
    this.error.set('');
    this.store.saveProfile(body).subscribe({
      next: () => {
        this.toast.success('Perfil actualizado');
        this.editing.set(false);
        this.saving.set(false);
      },
      error: (e) => {
        this.error.set(apiError(e));
        this.saving.set(false);
      }
    });
  }

  saveHistory() {
    if (this.hxForm.invalid) { this.hxForm.markAllAsTouched(); return; }
    const v = this.hxForm.getRawValue();
    this.saving.set(true);
    this.hxError.set('');
    this.store
      .addInjury({
        isHistory: true,
        bodyZone: v.bodyZone,
        injuryType: v.injuryType || undefined,
        occurredAt: v.occurredAt || undefined,
        daysAbsent: v.daysAbsent ?? undefined,
        recurrent: v.recurrent
      })
      .subscribe({
        next: () => {
          this.toast.success('Antecedente guardado');
          this.hxForm.reset({ bodyZone: '', injuryType: '', occurredAt: '', daysAbsent: null, recurrent: false });
          this.adding.set(false);
          this.saving.set(false);
        },
        error: (e) => {
          this.hxError.set(apiError(e));
          this.saving.set(false);
        }
      });
  }

  async removeHistory(h: Injury) {
    const ok = await confirmDialog({
      title: '¿Eliminar este antecedente?',
      text: `${h.bodyZone}${h.injuryType ? ' · ' + h.injuryType : ''}. Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      danger: true
    });
    if (!ok) return;
    this.store.removeInjury(h.id).subscribe({
      next: () => this.toast.success('Antecedente eliminado'),
      error: (e) => this.toast.error(apiError(e))
    });
  }
}