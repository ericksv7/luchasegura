import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { AuthService, apiError } from '../core/auth.service';
import { ZONES } from '../core/athlete-store';
import { confirmDialog } from '../core/confirm';
import { COMPONENTS, Exercise, ExerciseApi, mediaOf } from '../core/exercise-api';
import { ExThumb, ExerciseDialog, ExerciseView } from '../core/exercise-ui';
import { Icon, compClass, iconForComponent } from '../core/icon';
import { StateView } from '../core/state';
import { ToastService } from '../core/toast.service';
import { DelBtn } from '../core/del-btn';
import { EditBtn } from '../core/edit-btn';

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function mediaValidator(c: AbstractControl): ValidationErrors | null {
  const v = String(c.value ?? '').trim();
  return !v || mediaOf(v) ? null : { media: true };
}

@Component({
  selector: 'app-team-exercises',
  imports: [ReactiveFormsModule, Icon, ExThumb, ExerciseDialog, StateView, DelBtn, EditBtn],
  template: `
    <header class="page-head head-row">
      <div>
        <h1>Ejercicios</h1>
        <p class="sub">{{ canEdit ? 'Biblioteca de ejercicios que puedes asignar a los deportistas.' : 'Biblioteca de ejercicios del proyecto (solo lectura).' }}</p>
      </div>
      @if (canEdit && !formOpen()) {
        <button type="button" class="btn sm" (click)="openNew()"><app-icon name="plus" /> Nuevo ejercicio</button>
      }
    </header>

    @if (formOpen()) {
      <form class="card form section-sm" [formGroup]="form" (ngSubmit)="save()" novalidate aria-labelledby="x-form-t">
        <h2 id="x-form-t">{{ editingId() ? 'Editar ejercicio' : 'Nuevo ejercicio' }}</h2>

        <fieldset class="group">
          <legend>Tipo</legend>
          <div class="chips">
            @for (c of components; track c) {
              <button type="button" class="chip" [class.on]="comp() === c" [attr.aria-pressed]="comp() === c" (click)="comp.set(c)">
                <app-icon [name]="iconFor(c)" /> {{ c }}
              </button>
            }
          </div>
        </fieldset>

        <div class="field">
          <label for="x-name">Nombre</label>
          <input id="x-name" type="text" maxlength="80" formControlName="name" [attr.aria-invalid]="bad('name') ? 'true' : null" />
          @if (bad('name')) { <small class="msg" role="alert">Escribe el nombre del ejercicio (mínimo 2 letras)</small> }
        </div>

        <div class="field">
          <label for="x-desc">Cómo se hace <span class="opt">(opcional)</span></label>
          <textarea id="x-desc" rows="4" maxlength="600" formControlName="description"></textarea>
        </div>

        <div class="two">
          <div class="field">
            <label for="x-dos">Dosificación <span class="opt">(opcional)</span></label>
            <input id="x-dos" type="text" maxlength="80" placeholder="Ej. 3 × 12 por lado" formControlName="dosage" />
          </div>
          <div class="field">
            <label for="x-zone">Zona a la que apunta <span class="opt">(opcional)</span></label>
            <select id="x-zone" formControlName="zone">
              <option value="">Ninguna en particular</option>
              @for (z of zones; track z) { <option [value]="z">{{ z }}</option> }
            </select>
          </div>
        </div>

        <div class="field">
          <label for="x-media">Video o ilustración <span class="opt">(opcional)</span></label>
          <input id="x-media" type="url" inputmode="url" maxlength="300" placeholder="https://www.youtube.com/watch?v=…"
            formControlName="mediaUrl" [attr.aria-invalid]="bad('mediaUrl') ? 'true' : null" />
          @if (bad('mediaUrl')) {
            <small class="msg" role="alert">Usa un enlace https de YouTube o Vimeo, o de una imagen (.jpg, .png, .gif, .webp)</small>
          } @else {
            <small class="hint">Pega el enlace de un video de YouTube o Vimeo, o de una imagen.</small>
          }
          @if (preview(); as p) {
            <div class="media-prev">
              <app-ex-thumb [component]="comp()" [mediaUrl]="p" [big]="true" [alt]="'Vista previa'" />
              <small>Así se verá en la lista</small>
            </div>
          }
        </div>

        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <div class="actions">
          <button type="button" class="btn secondary" (click)="closeForm()">Cancelar</button>
          <button class="btn" [attr.aria-busy]="saving()" [disabled]="saving()">
            <app-icon name="save" /> {{ saving() ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </form>
    }

    @if (failed()) {
      <app-state kind="error" title="No pudimos cargar los ejercicios"
        text="Revisa tu conexión e inténtalo de nuevo." action="Reintentar" (act)="load()" />
    } @else if (loading()) {
      <div class="ex-grid" aria-busy="true" aria-label="Cargando">
        <div class="sk sk-ath"></div><div class="sk sk-ath"></div><div class="sk sk-ath"></div>
      </div>
    } @else if (!items().length) {
      <div class="card">
        <app-state kind="empty" title="Aún no hay ejercicios"
          [text]="canEdit ? 'Crea el primero para poder asignarlo a los deportistas.' : 'El fisioterapeuta aún no ha cargado ejercicios.'"
          [action]="canEdit && !formOpen() ? 'Crear ejercicio' : ''" (act)="openNew()" />
      </div>
    } @else {
      <div class="toolbar">
        <div class="field">
          <label for="x-q">Buscar ejercicio</label>
          <input id="x-q" type="search" placeholder="Nombre o zona" [value]="q()" (input)="q.set($any($event.target).value)" />
        </div>
        <div class="chips" role="group" aria-label="Filtrar por tipo">
          <button type="button" class="chip" [class.on]="filter() === 'all'" [attr.aria-pressed]="filter() === 'all'" (click)="filter.set('all')">
            Todos · {{ items().length }}
          </button>
          @for (c of components; track c) {
            <button type="button" class="chip" [class.on]="filter() === c" [attr.aria-pressed]="filter() === c" (click)="filter.set(c)">
              <app-icon [name]="iconFor(c)" /> {{ c }} · {{ counts()[c] }}
            </button>
          }
        </div>
      </div>

      @if (filtered().length) {
        <ul class="ex-grid">
          @for (e of filtered(); track e.id) {
            <li class="exc">
              <button type="button" class="exc-main" (click)="view(e)" [attr.aria-label]="'Ver el ejercicio ' + e.name">
                <app-ex-thumb [component]="e.component" [mediaUrl]="e.mediaUrl" [alt]="'Ilustración de ' + e.name" />
                <span class="exc-text">
                  <strong>{{ e.name }}</strong>
                  <small>{{ e.dosage || 'Sin dosificación' }}</small>
                </span>
              </button>
              <div class="exc-meta">
                <span [class]="'tag comp ' + cls(e.component)"><app-icon [name]="iconFor(e.component)" /> {{ e.component }}</span>
                @if (e.zone) { <span class="badge mid">{{ e.zone }}</span> }
                @if (e.assigned) { <span class="badge low">{{ e.assigned }} {{ e.assigned === 1 ? 'asignación' : 'asignaciones' }}</span> }
              </div>
              @if (canEdit) {
                <div class="exc-actions">
                  <span class="action-slot" data-action="Editar"><button appEdit (click)="openEdit(e)"></button></span>
                  <span class="action-slot" data-action="Eliminar"><button appDel [label]="'Eliminar ' + e.name" (click)="remove(e)"></button></span>
                </div>
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

    <app-exercise-dialog [ex]="selected()" (done)="selected.set(null)" />
  `
})
export class TeamExercisesPage {
  private api = inject(ExerciseApi);
  private fb = inject(NonNullableFormBuilder);
  private toast = inject(ToastService);

  canEdit = inject(AuthService).user()?.role === 'PHYSIO';
  components = COMPONENTS;
  zones = ZONES;
  iconFor = iconForComponent;
  cls = compClass;

  items = signal<Exercise[]>([]);
  loading = signal(true);
  failed = signal(false);
  q = signal('');
  filter = signal<string>('all');
  selected = signal<ExerciseView | null>(null);

  formOpen = signal(false);
  editingId = signal<string | null>(null);
  comp = signal<string>('Movilidad');
  saving = signal(false);
  error = signal('');

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    description: [''],
    dosage: [''],
    zone: [''],
    mediaUrl: ['', mediaValidator]
  });
  private mediaVal = toSignal(this.form.controls.mediaUrl.valueChanges, { initialValue: '' });
  preview = computed(() => (mediaOf(this.mediaVal()) ? this.mediaVal().trim() : null));

  counts = computed(() => {
    const r: Record<string, number> = { Movilidad: 0, Estabilidad: 0, Fuerza: 0, 'Técnica': 0 };
    for (const e of this.items()) r[e.component] = (r[e.component] ?? 0) + 1;
    return r;
  });
  filtered = computed(() => {
    const q = norm(this.q().trim());
    const f = this.filter();
    return this.items().filter(
      (e) => (f === 'all' || e.component === f) && (!q || norm(e.name).includes(q) || norm(e.zone ?? '').includes(q))
    );
  });

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.failed.set(false);
    this.api.list().subscribe({
      next: (l) => { this.items.set(l); this.loading.set(false); },
      error: () => { this.failed.set(true); this.loading.set(false); }
    });
  }

  bad(name: string) {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  view(e: Exercise) { this.selected.set(e); }

  openNew() {
    this.editingId.set(null);
    this.comp.set('Movilidad');
    this.form.reset({ name: '', description: '', dosage: '', zone: '', mediaUrl: '' });
    this.error.set('');
    this.formOpen.set(true);
  }

  openEdit(e: Exercise) {
    this.editingId.set(e.id);
    this.comp.set(e.component);
    this.form.reset({
      name: e.name,
      description: e.description ?? '',
      dosage: e.dosage ?? '',
      zone: e.zone ?? '',
      mediaUrl: e.mediaUrl ?? ''
    });
    this.error.set('');
    this.formOpen.set(true);
  }

  closeForm() {
    this.formOpen.set(false);
    this.editingId.set(null);
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const body = {
      component: this.comp(),
      name: v.name.trim(),
      description: v.description.trim() || null,
      dosage: v.dosage.trim() || null,
      zone: v.zone || null,
      mediaUrl: v.mediaUrl.trim() || null
    };
    const id = this.editingId();
    this.saving.set(true);
    this.error.set('');
    const req = id ? this.api.update(id, body) : this.api.create(body);
    req.subscribe({
      next: (e) => {
        const sorted = (l: Exercise[]) =>
          [...l].sort((a, b) => a.component.localeCompare(b.component) || a.name.localeCompare(b.name));
        this.items.update((l) => sorted(id ? l.map((x) => (x.id === e.id ? e : x)) : [...l, e]));
        this.toast.success(id ? 'Ejercicio actualizado' : 'Ejercicio creado');
        this.saving.set(false);
        this.closeForm();
      },
      error: (e) => { this.error.set(apiError(e)); this.saving.set(false); }
    });
  }

  async remove(e: Exercise) {
    const used = e.assigned ?? 0;
    const ok = await confirmDialog({
      title: '¿Eliminar este ejercicio?',
      text: used
        ? `Está asignado a ${used} ${used === 1 ? 'deportista' : 'deportistas'}. Se archivará: dejará de aparecer en la biblioteca, pero las asignaciones existentes se conservan.`
        : `${e.name}. Se eliminará de la biblioteca.`,
      confirmText: 'Eliminar',
      danger: true
    });
    if (!ok) return;
    this.api.remove(e.id).subscribe({
      next: (r) => {
        this.items.update((l) => l.filter((x) => x.id !== e.id));
        this.toast.success(r.archived ? 'Ejercicio archivado' : 'Ejercicio eliminado');
      },
      error: (err) => this.toast.error(apiError(err))
    });
  }
}
