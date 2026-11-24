import { afterNextRender, Component, computed, ElementRef, inject, Injector, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService, apiError } from '../core/auth.service';
import { RouterLink } from '@angular/router';
import { ZONES } from '../core/athlete-store';
import { confirmDialog } from '../core/confirm';
import { COMPONENTS, Exercise, ExerciseApi, ILLUSTRATIONS, LEVELS, exerciseCategoryLabel, exerciseGroups, matchesExerciseSearch, normalizeExerciseSearch } from '../core/exercise-api';
import { ExThumb, ExerciseDialog, ExerciseView } from '../core/exercise-ui';
import { Icon, compClass, iconForComponent } from '../core/icon';
import { StateView } from '../core/state';
import { ToastService } from '../core/toast.service';
import { DelBtn } from '../core/del-btn';
import { EditBtn } from '../core/edit-btn';

@Component({
  selector: 'app-team-exercises',
  styles: `
    .exercise-header-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .exercise-filters {
      display: grid; gap: 12px; margin-block: 16px;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr));
    }
    .exc-main { display: grid; gap: 10px; align-items: start; }
    .exc-text { gap: 4px; }
    .exercise-preview { display: grid; gap: 8px; max-width: 380px; justify-items: start; }
    .exercise-preview app-ex-thumb { width: 100%; }
  `,
  imports: [ReactiveFormsModule, Icon, ExThumb, ExerciseDialog, StateView, DelBtn, EditBtn, RouterLink],
  template: `
    <header class="page-head head-row">
      <div>
        <h1 #pageTitle tabindex="-1">Biblioteca de ejercicios</h1>
        <p class="sub">{{ canEdit ? 'Consulta las fichas, prepara ejercicios y asigna indicaciones individuales.' : 'Biblioteca de ejercicios del proyecto (solo lectura).' }}</p>
      </div>
      @if (canEdit) {
        <div class="exercise-header-actions">
          <a class="btn secondary sm" routerLink="/equipo/deportistas"><app-icon name="users" /> Ir a deportistas</a>
          @if (!formOpen() && items().length) {
            <button type="button" class="btn sm" (click)="openNew($event)"><app-icon name="plus" /> Nuevo ejercicio</button>
          }
        </div>
      }
    </header>

    @if (formOpen()) {
      <form class="card form section-sm" [formGroup]="form" (ngSubmit)="save()" novalidate aria-labelledby="x-form-t">
        <h2 id="x-form-t" #formTitle tabindex="-1">{{ editingId() ? 'Editar ejercicio' : 'Nuevo ejercicio' }}</h2>

        <fieldset class="group">
          <legend>Categoría</legend>
          <div class="chips">
            @for (c of components; track c) {
              <button type="button" class="chip" [class.on]="comp() === c" [attr.aria-pressed]="comp() === c" (click)="comp.set(c)">
                <app-icon [name]="iconFor(c)" /> {{ categoryLabel(c) }}
              </button>
            }
          </div>
        </fieldset>

        <div class="field">
          <label for="x-name">Nombre <span class="opt">(obligatorio)</span></label>
          <input id="x-name" type="text" maxlength="80" formControlName="name" [attr.aria-describedby]="bad('name') ? 'x-name-error' : null" [attr.aria-invalid]="bad('name') ? 'true' : null" />
          @if (bad('name')) { <small class="msg" id="x-name-error" role="alert">Escribe el nombre del ejercicio (mínimo 2 letras)</small> }
        </div>

        <div class="field">
          <label for="x-desc">Descripción breve</label>
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
              @for (z of zones(); track z) { <option [value]="z">{{ z }}</option> }
            </select>
          </div>
        </div>

        <div class="two">
          <div class="field">
            <label for="x-objective">Objetivo</label>
            <input id="x-objective" maxlength="240" formControlName="objective" />
          </div>
          <div class="field">
            <label for="x-level">Nivel</label>
            <select id="x-level" formControlName="level">
              <option value="">Sin indicar</option>
              @for (level of levels; track level) { <option [value]="level">{{ level }}</option> }
            </select>
          </div>
        </div>
        <div class="field">
          <label for="x-equipment">Implementos</label>
          <input id="x-equipment" maxlength="140" placeholder="Ej. Colchoneta o ninguno" formControlName="equipment" />
        </div>
        <div class="field">
          <label for="x-instructions">Cómo se hace</label>
          <textarea id="x-instructions" rows="4" maxlength="1500" formControlName="instructions"
            aria-describedby="x-instructions-hint"></textarea>
          <small id="x-instructions-hint" class="hint">Escribe un paso por línea.</small>
        </div>
        <div class="two">
          <div class="field">
            <label for="x-mistakes">Errores comunes</label>
            <textarea id="x-mistakes" rows="2" maxlength="400" formControlName="mistakes"></textarea>
          </div>
          <div class="field">
            <label for="x-precautions">Precauciones</label>
            <textarea id="x-precautions" rows="2" maxlength="400" formControlName="precautions"></textarea>
          </div>
        </div>
        <fieldset class="group">
          <legend>Ilustración del movimiento</legend>
          <div class="two">
            <div class="field">
              <label for="x-illustration">Ilustraciones de la biblioteca</label>
              <select id="x-illustration" [value]="libraryIllustration()" (change)="chooseIllustration($any($event.target).value)">
                <option value="">Selecciona una postura</option>
                @for (option of illustrations; track option.path) {
                  <option [value]="option.path">{{ option.label }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label for="x-image">O adjunta una imagen propia</label>
              <input id="x-image" type="file" accept="image/png,image/jpeg,image/webp"
                aria-describedby="x-image-hint" (change)="attachIllustration($event)" />
              <small id="x-image-hint" class="hint">PNG, JPG o WebP de hasta 64 KB.</small>
            </div>
          </div>
          @if (imageError()) { <p class="error" role="alert">{{ imageError() }}</p> }
          @if (illustration(); as image) {
            <div class="exercise-preview">
              <app-ex-thumb mode="detail" [component]="comp()" [illustration]="image" alt="Vista previa de la ilustración" />
              <button type="button" class="btn secondary sm" (click)="chooseIllustration('')">Quitar ilustración</button>
            </div>
          }
        </fieldset>

        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <div class="actions form-actions">
          <button type="button" class="btn tertiary" [disabled]="saving()" (click)="closeForm()">Cancelar</button>
          <button class="btn" [attr.aria-busy]="saving()" [disabled]="saving() || imageLoading()">
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
      <div class="card exercise-filters">
        <div class="field">
          <label for="x-q">Buscar por nombre o implemento</label>
          <input id="x-q" type="search" placeholder="Ej. Sentadilla o banda" [value]="q()" (input)="q.set($any($event.target).value)" />
        </div>
        <div class="field">
          <label for="x-category-filter">Categoría</label>
          <select id="x-category-filter" [value]="filter()" (change)="filter.set($any($event.target).value)">
            <option value="">Todas</option>
            @for (c of components; track c) { <option [value]="c">{{ categoryLabel(c) }}</option> }
          </select>
        </div>
        <div class="field">
          <label for="x-zone-filter">Zona corporal</label>
          <select id="x-zone-filter" [value]="zoneFilter()" (change)="zoneFilter.set($any($event.target).value)">
            <option value="">Todas</option>
            @for (z of filterZones(); track z) { <option [value]="z">{{ z }}</option> }
          </select>
        </div>
        <div class="field">
          <label for="x-level-filter">Nivel</label>
          <select id="x-level-filter" [value]="levelFilter()" (change)="levelFilter.set($any($event.target).value)">
            <option value="">Todos</option>
            @for (level of levels; track level) { <option [value]="level">{{ level }}</option> }
          </select>
        </div>
      </div>

      @if (filtered().length) {
        <p class="results-line" role="status">{{ filtered().length }} de {{ items().length }} ejercicios</p>
        <ul class="ex-grid">
          @for (e of filtered(); track e.id) {
            <li class="exc">
              <button type="button" class="exc-main" (click)="view(e)" [attr.aria-label]="'Ver el ejercicio ' + e.name">
                <app-ex-thumb mode="card" [component]="e.component" [illustration]="e.illustration" />
                <span class="exc-text">
                  <strong>{{ e.name }}</strong>
                  @if (e.description) { <small>{{ e.description }}</small> }
                  @if (e.equipment) { <small><strong>Implementos</strong> · {{ e.equipment }}</small> }
                </span>
              </button>
              <div class="exc-meta">
                <span [class]="'tag comp ' + cls(e.component)"><app-icon [name]="iconFor(e.component)" /> {{ categoryLabel(e.component) }}</span>
                @if (e.zone) { <span class="badge mid">{{ e.zone }}</span> }
                @if (e.level) { <span class="badge mid">{{ e.level }}</span> }
                @if (e.assigned) { <span class="badge low">{{ e.assigned }} {{ e.assigned === 1 ? 'asignación' : 'asignaciones' }}</span> }
              </div>
              @if (canEdit) {
                <footer class="exc-footer"><div class="compact-actions" role="group" [attr.aria-label]="'Acciones para ' + e.name">
                  <button appEdit [label]="'Editar ' + e.name" (click)="openEdit(e, $event)"></button>
                  <button appDel [text]="e.isBase || e.inProgram || e.assigned ? 'Archivar' : 'Eliminar'"
                    [label]="(e.isBase || e.inProgram || e.assigned ? 'Archivar ' : 'Eliminar ') + e.name" (click)="remove(e)"></button>
                </div></footer>
              }
            </li>
          }
        </ul>
      } @else {
        <div class="card">
          <app-state kind="empty" title="Sin resultados" text="Prueba con otro nombre o cambia el filtro." action="Limpiar filtros"
            (act)="clearFilters()" />
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
  categoryLabel = exerciseCategoryLabel;
  components = COMPONENTS;
  levels = LEVELS;
  illustrations = ILLUSTRATIONS;
  zones = computed(() => [...new Set([...ZONES, this.formZone()])].filter(Boolean));
  private formZone = signal('');
  iconFor = iconForComponent;
  cls = compClass;

  items = signal<Exercise[]>([]);
  loading = signal(true);
  failed = signal(false);
  q = signal('');
  filter = signal('');
  zoneFilter = signal('');
  levelFilter = signal('');
  filterZones = computed(() => [...new Set(this.items().flatMap(e => e.zone ? [e.zone] : []))].sort((a, b) => a.localeCompare(b)));
  private imageRequest = 0;
  imageError = signal('');
  imageLoading = signal(false);
  private hadIllustration = false;
  illustration = signal('');
  libraryIllustration = computed(() => this.illustration().startsWith('/exercises/') ? this.illustration() : '');
  selected = signal<ExerciseView | null>(null);

  formOpen = signal(false);
  editingId = signal<string | null>(null);
  comp = signal<string>('Fuerza');
  saving = signal(false);
  error = signal('');

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    description: [''],
    dosage: [''],
    zone: [''],
    objective: [''], level: [''], equipment: [''], instructions: [''], mistakes: [''], precautions: ['']
  });
  filtered = computed(() => {
    const q = normalizeExerciseSearch(this.q());
    const category = this.filter();
    const zone = this.zoneFilter();
    const level = this.levelFilter();
    const matches = this.items().filter(e => (!category || e.component === category)
      && (!zone || e.zone === zone) && (!level || e.level === level) && matchesExerciseSearch(e, q));
    return exerciseGroups(matches, e => e.component).flatMap(group => group.items);
  });

  clearFilters() {
    this.q.set('');
    this.filter.set('');
    this.zoneFilter.set('');
    this.levelFilter.set('');
  }

  chooseIllustration(src: string) {
    this.imageRequest++;
    this.imageLoading.set(false);
    this.imageError.set('');
    this.illustration.set(src);
  }

  attachIllustration(event: Event) {
    const element = event.target as HTMLInputElement;
    const file = element.files?.[0];
    element.value = '';
    if (!file) return;

    const request = ++this.imageRequest;
    this.imageError.set('');
    const finish = (src?: string) => {
      if (request !== this.imageRequest) return;
      this.imageLoading.set(false);
      if (src) this.illustration.set(src);
      else this.imageError.set('Adjunta una imagen válida PNG, JPG o WebP de hasta 64 KB.');
    };
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 64 * 1024) {
      finish();
      return;
    }

    this.imageLoading.set(true);
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      const image = new Image();
      image.onload = () => finish(src);
      image.onerror = () => finish();
      image.src = src;
    };
    reader.onerror = () => finish();
    reader.readAsDataURL(file);
  }

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

  private injector = inject(Injector);
  private formTitle = viewChild<ElementRef<HTMLElement>>('formTitle');
  private pageTitle = viewChild<ElementRef<HTMLElement>>('pageTitle');
  private formTrigger: HTMLElement | null = null;

  private showForm(event?: Event) {
    this.formTrigger = event?.currentTarget as HTMLElement | null ?? null;
    this.formOpen.set(true);
    afterNextRender(() => this.formTitle()?.nativeElement.focus(), { injector: this.injector });
  }

  openNew(event?: Event) {
    this.editingId.set(null);
    this.comp.set('Fuerza');
    this.form.reset();
    this.formZone.set('');
    this.chooseIllustration('');
    this.hadIllustration = false;
    this.error.set('');
    this.showForm(event);
  }

  openEdit(e: Exercise, event: Event) {
    this.editingId.set(e.id);
    this.comp.set(e.component);
    this.formZone.set(e.zone ?? '');
    this.chooseIllustration(e.illustration ?? '');
    this.hadIllustration = !!e.illustration;
    this.form.reset({
      name: e.name,
      description: e.description ?? '',
      dosage: e.dosage ?? '',
      zone: e.zone ?? '',
      objective: e.objective ?? '',
      level: e.level ?? '',
      equipment: e.equipment ?? '',
      instructions: e.instructions ?? '',
      mistakes: e.mistakes ?? '',
      precautions: e.precautions ?? ''
    });
    this.error.set('');
    this.showForm(event);
  }

  closeForm() {
    const trigger = this.formTrigger;
    this.formTrigger = null;
    this.formOpen.set(false);
    this.editingId.set(null);
    afterNextRender(() => {
      (trigger?.isConnected ? trigger : this.pageTitle()?.nativeElement)?.focus();
    }, { injector: this.injector });
  }

  save() {
    if (this.saving() || this.imageLoading()) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if ((!this.editingId() || this.hadIllustration) && !this.illustration()) {
      this.imageError.set('Selecciona o adjunta una ilustración del ejercicio.');
      return;
    }
    const v = this.form.getRawValue();
    const body = {
      component: this.comp(),
      name: v.name.trim(),
      description: v.description.trim() || null,
      dosage: v.dosage.trim() || null,
      zone: v.zone || null,
      objective: v.objective.trim() || null,
      level: v.level || null,
      equipment: v.equipment.trim() || null,
      instructions: v.instructions.trim() || null,
      mistakes: v.mistakes.trim() || null,
      precautions: v.precautions.trim() || null,
      illustration: this.illustration() || null
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
    const archive = e.isBase || e.inProgram || !!e.assigned;
    const action = archive ? 'Archivar' : 'Eliminar';
    const ok = await confirmDialog({
      title: `¿${action} este ejercicio?`,
      text: archive
        ? `${e.name} saldrá del catálogo activo. Las sesiones y asignaciones existentes seguirán disponibles.`
        : `${e.name} se eliminará de la biblioteca.`,
      confirmText: action,
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
