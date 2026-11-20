import { ageOf } from '../core/age';
import { bogotaDay, formatHistoryDay } from '../core/civil-date';
import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService, apiError } from '../core/auth.service';
import { AthleteStore, Injury, ZONES } from '../core/athlete-store';
import { confirmDialog } from '../core/confirm';
import { StateView } from '../core/state';
import { ToastService } from '../core/toast.service';
import { DelBtn } from '../core/del-btn';
import { EditBtn } from '../core/edit-btn';

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, RouterLink, StateView, DelBtn, EditBtn],
  template: `
    <header class="page-head">
      <h1>Mi perfil</h1>
      <p class="sub">Actualiza tus datos y registra antecedentes para que fisioterapia pueda consultarlos.</p>
      <a routerLink="../evaluaciones">Mis evaluaciones funcionales</a>
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
            @if (!editing()) { <span class="action-slot" data-action="Editar"><button appEdit (click)="edit()"></button></span> }
          </div>

          @if (editing()) {
            <form class="form" [formGroup]="form" (ngSubmit)="save()">
              <div class="field"><label for="p-birth">Fecha de nacimiento</label><input id="p-birth" type="date" [attr.max]="today" formControlName="birthDate" /></div>
              <div class="field"><label for="p-weight">Peso (kg)</label><input id="p-weight" type="number" step="0.1" min="25" max="200" formControlName="weightKg" [attr.aria-invalid]="form.controls.weightKg.touched && form.controls.weightKg.invalid ? 'true' : null"
                [attr.aria-describedby]="form.controls.weightKg.touched && form.controls.weightKg.invalid ? 'p-weight-error' : null" />
                @if (form.controls.weightKg.touched && form.controls.weightKg.invalid) { <small class="msg" role="alert" id="p-weight-error">Indica un peso entre 25 y 200 kg.</small> }
              </div>
              <div class="field"><label for="p-cat">Categoría de peso</label><input id="p-cat" type="text" maxlength="40" placeholder="Ej. 65 kg" formControlName="category" /></div>
              <div class="field"><label for="p-style">Estilo</label>
                <select id="p-style" formControlName="style">
                  <option value="">Sin elegir</option>
                  <option>Libre</option><option>Grecorromana</option><option>Femenina</option>
                </select>
              </div>
              <div class="field"><label for="p-exp">Años de experiencia</label><input id="p-exp" type="number" min="0" max="50" formControlName="yearsExperience" [attr.aria-invalid]="form.controls.yearsExperience.touched && form.controls.yearsExperience.invalid ? 'true' : null"
                [attr.aria-describedby]="form.controls.yearsExperience.touched && form.controls.yearsExperience.invalid ? 'p-exp-error' : null" />
                @if (form.controls.yearsExperience.touched && form.controls.yearsExperience.invalid) { <small class="msg" role="alert" id="p-exp-error">Indica los años de experiencia entre 0 y 50.</small> }
              </div>
              <div class="field"><label for="p-notes">Observaciones</label><textarea id="p-notes" rows="3" maxlength="1000" formControlName="notes"></textarea></div>
              @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
              <div class="actions">
                <button type="button" class="btn secondary" [disabled]="saving()" (click)="editing.set(false)">Cancelar</button>
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
              <button type="button" class="btn secondary sm" (click)="openHistory()">Agregar</button>
            }
          </div>

          @if (adding()) {
            <form class="form" [formGroup]="hxForm" (ngSubmit)="saveHistory()">
              <h3>{{ historyId() ? 'Editar antecedente' : 'Agregar antecedente' }}</h3>
              <div class="field"><label for="h-zone">Zona del cuerpo <span class="opt">(obligatorio)</span></label>
                <select id="h-zone" formControlName="bodyZone" [attr.aria-invalid]="hxForm.controls.bodyZone.touched && hxForm.controls.bodyZone.invalid ? 'true' : null">
                  <option value="">Elige una zona</option>
                  @for (z of zones; track z) { <option [value]="z">{{ z }}</option> }
                </select>
                @if (hxForm.controls.bodyZone.touched && hxForm.controls.bodyZone.invalid) { <small class="msg" role="alert">Elige la zona</small> }
              </div>
              <div class="field"><label for="h-type">Tipo de lesión <span class="opt">(opcional)</span></label><input id="h-type" type="text" maxlength="80" placeholder="Ej. esguince" formControlName="injuryType" /></div>
              <div class="field"><label for="h-date">¿Cuándo ocurrió? <span class="opt">(opcional)</span></label><input id="h-date" type="date" [attr.max]="today" formControlName="occurredAt" /></div>
              <div class="field"><label for="h-days">Días sin entrenar <span class="opt">(opcional)</span></label><input id="h-days" type="number" min="0" max="3650" step="1" formControlName="daysAbsent" [attr.aria-invalid]="hxForm.controls.daysAbsent.touched && hxForm.controls.daysAbsent.invalid ? 'true' : null"
                [attr.aria-describedby]="hxForm.controls.daysAbsent.touched && hxForm.controls.daysAbsent.invalid ? 'h-days-error' : null" />
                @if (hxForm.controls.daysAbsent.touched && hxForm.controls.daysAbsent.invalid) { <small class="msg" role="alert" id="h-days-error">Indica entre 0 y 3650 días.</small> }
              </div>
              <label class="check"><input type="checkbox" formControlName="recurrent" /><span>Ha vuelto a ocurrir</span></label>
              @if (hxError()) { <p class="error" role="alert">{{ hxError() }}</p> }
              <div class="actions">
                <button type="button" class="btn secondary" [disabled]="saving()" (click)="adding.set(false)">Cancelar</button>
                <button class="btn" [attr.aria-busy]="saving()" [disabled]="saving()">{{ saving() ? 'Guardando…' : 'Guardar' }}</button>
              </div>
            </form>
          } @else if (store.history().length) {
            <ul class="list">
              @for (h of store.history(); track h.id) {
                <li>
                  <div>
                    <strong>{{ h.bodyZone }}{{ h.injuryType ? ' · ' + h.injuryType : '' }}</strong>
                    <small>{{ formatHistoryDay(h.historyDate) }}{{ h.daysAbsent !== null ? ' · ' + h.daysAbsent + ' días sin entrenar' : '' }}</small>
                    @if (h.recurrent) { <span class="badge mid history-recurrent">Recurrente</span> }
                  </div>
                  <span class="row-actions">
                    <span class="action-slot" data-action="Editar"><button appEdit [label]="'Editar antecedente de ' + h.bodyZone" (click)="openHistory(h)"></button></span>
                    <span class="action-slot" data-action="Eliminar"><button appDel [label]="'Eliminar antecedente de ' + h.bodyZone" (click)="removeHistory(h)"></button></span>
                  </span>
                </li>
              }
            </ul>
          } @else {
            <app-state kind="empty" title="Sin antecedentes registrados"
              text="Si has tenido lesiones antes, agrégalas para que tu equipo las tenga presentes."
              action="Agregar antecedente" (act)="openHistory()" />
          }
        </section>

        <div class="span-2 actions">
          <a class="btn secondary" routerLink="/cambiar-contrasena">Cambiar contraseña</a>
          <button type="button" class="btn secondary" (click)="auth.askLogout()">Cerrar sesión</button>
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
  formatHistoryDay = formatHistoryDay;
  get today() { return bogotaDay(); }
  private originalHistoryDate = '';
  editing = signal(false);
  adding = signal(false);
  historyId = signal<string | null>(null);
  private historyRequest?: { payload: string; id: string };
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

  age = computed(() => ageOf(this.store.profile()?.birthDate?.slice(0, 10) ?? ''));

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
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('');
      return;
    }
    const v = this.form.getRawValue();
    const body = {
      ...(v.birthDate ? { birthDate: v.birthDate } : {}),
      weightKg: v.weightKg, category: v.category.trim() || null, style: v.style || null,
      yearsExperience: v.yearsExperience, notes: v.notes.trim() || null
    };

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

  openHistory(record?: Injury) {
    this.historyId.set(record?.id ?? null);
    this.hxError.set('');
    this.historyRequest = undefined;
    this.originalHistoryDate = record?.historyDate ?? '';
    this.hxForm.reset({
      bodyZone: record?.bodyZone ?? '', injuryType: record?.injuryType ?? '',
      occurredAt: this.originalHistoryDate, daysAbsent: record?.daysAbsent ?? null,
      recurrent: record?.recurrent ?? false
    });
    this.adding.set(true);
  }

  saveHistory() {
    if (this.saving()) return;
    if (this.hxForm.invalid) {
      this.hxForm.markAllAsTouched();
      this.hxError.set('');
      return;
    }
    const { occurredAt, ...fields } = this.hxForm.getRawValue();
    const id = this.historyId();
    const historyDate = occurredAt === this.originalHistoryDate ? undefined : occurredAt || null;
    const body = { ...fields, historyDate, injuryType: fields.injuryType.trim() || null };
    const payload = JSON.stringify(body);
    if (!id && this.historyRequest?.payload !== payload) this.historyRequest = { payload, id: globalThis.crypto.randomUUID() };
    this.saving.set(true);
    this.hxError.set('');
    (id ? this.store.updateHistory(id, body) : this.store.addInjury({
      ...body, isHistory: true, injuryType: body.injuryType ?? undefined, daysAbsent: body.daysAbsent ?? undefined
    }, this.historyRequest!.id))
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
