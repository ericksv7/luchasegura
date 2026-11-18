import { Component, DestroyRef, effect, inject, input, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService, apiError } from '../core/auth.service';
import { Assignment, COMPONENTS, Exercise, ExerciseApi } from '../core/exercise-api';
import { ExThumb, ExerciseDialog, ExerciseView } from '../core/exercise-ui';
import { Icon, compClass, iconForComponent } from '../core/icon';
import { confirmDialog } from '../core/confirm';
import { StateView } from '../core/state';
import { ToastService } from '../core/toast.service';
import { Injury } from '../core/athlete-store';
import { DelBtn } from '../core/del-btn';

@Component({
  selector: 'app-athlete-exercises',
  imports: [ReactiveFormsModule, Icon, ExThumb, ExerciseDialog, StateView, DelBtn],
  template: `
        <section class="card span-2" aria-labelledby="d-e">
          <div class="card-head">
            <div>
              <h2 id="d-e">Ejercicios asignados</h2>
              <p class="meta">Consulta las indicaciones individuales y la dosificación. Selecciona un ejercicio para ver su detalle.</p>
            </div>
            @if (isPhysio && !assigning() && !aLoading() && !aFailed()) {
              <button type="button" class="btn sm" (click)="openAssign()"><app-icon name="plus" /> Asignar ejercicio</button>
            }
          </div>

          @if (assigning()) {
            <form class="assign" [formGroup]="aForm" (ngSubmit)="assign()" novalidate>
              @if (suggested().length) {
                <div>
                  <p class="lbl">Sugeridos por sus molestias</p>
                  <div class="chips">
                    @for (s of suggested(); track s.id) {
                      <button type="button" class="chip" [class.on]="aForm.controls.exerciseId.value === s.id"
                        [attr.aria-pressed]="aForm.controls.exerciseId.value === s.id" (click)="pick(s)">
                        <app-icon [name]="iconFor(s.component)" /> {{ s.name }}
                      </button>
                    }
                  </div>
                </div>
              }
              <div class="field">
                <label for="a-ex">Ejercicio</label>
                <select id="a-ex" formControlName="exerciseId"
                  [attr.aria-invalid]="aForm.controls.exerciseId.touched && aForm.controls.exerciseId.invalid ? 'true' : null">
                  <option value="">{{ libLoading() ? 'Cargando…' : 'Elige un ejercicio' }}</option>
                  @for (g of libGroups(); track g.c) {
                    <optgroup [label]="g.c">
                      @for (e of g.items; track e.id) { <option [value]="e.id">{{ e.name }}{{ e.zone ? ' · ' + e.zone : '' }}</option> }
                    </optgroup>
                  }
                </select>
                @if (aForm.controls.exerciseId.touched && aForm.controls.exerciseId.invalid) {
                  <small class="msg" role="alert">Elige un ejercicio</small>
                }
                @if (!libLoading() && !available().length) {
                  <small class="hint">No quedan ejercicios por asignar. Crea más en la pantalla Ejercicios.</small>
                }
              </div>
              <div class="field">
                <label for="a-dos">Dosificación <span class="opt">(opcional)</span></label>
                <input id="a-dos" type="text" maxlength="80" placeholder="Ej. 3 × 12" formControlName="dosage" />
                <small class="hint">Si la dejas vacía se usa la del ejercicio.</small>
              </div>
              <div class="field">
                <label for="a-note">Indicación para el deportista <span class="opt">(opcional)</span></label>
                <textarea id="a-note" rows="2" maxlength="300" formControlName="note"></textarea>
              </div>
              @if (aError()) { <p class="error" role="alert">{{ aError() }}</p> }
              <div class="actions">
                <button type="button" class="btn secondary" (click)="assigning.set(false)">Cancelar</button>
                <button class="btn" [attr.aria-busy]="saving()" [disabled]="saving()">
                  <app-icon name="check" /> {{ saving() ? 'Asignando…' : 'Asignar' }}
                </button>
              </div>
            </form>
          }

          @if (aLoading()) {
            <div class="stack" aria-busy="true" aria-label="Cargando">
              <div class="sk sk-row"></div><div class="sk sk-row"></div>
            </div>
          } @else if (aFailed()) {
            <app-state kind="error" title="No pudimos cargar los ejercicios" action="Reintentar" (act)="loadAssignments()" />
          } @else if (groups().length) {
            @for (g of groups(); track g.c) {
              <h3 class="grp">
                <span [class]="'grp-ic ' + cls(g.c)"><app-icon [name]="iconFor(g.c)" /></span>
                {{ g.c }} <small>{{ g.items.length }}</small>
              </h3>
              <ul class="asg-list">
                @for (a of g.items; track a.id) {
                  <li>
                    <button type="button" class="asg-main" (click)="view(a)" [attr.aria-label]="'Ver el ejercicio ' + a.exercise.name">
                      <app-ex-thumb [component]="a.exercise.component" [mediaUrl]="a.exercise.mediaUrl" [alt]="'Ilustración de ' + a.exercise.name" />
                      <span class="exc-text">
                        <strong>{{ a.exercise.name }}</strong>
                        <small>{{ a.dosage || a.exercise.dosage || 'Sin dosificación' }}{{ a.exercise.zone ? ' · ' + a.exercise.zone : '' }}</small>
                        @if (a.note) { <small class="asg-note">{{ a.note }}</small> }
                      </span>
                    </button>
                    @if (isPhysio) {
                      <span class="action-slot" data-action="Quitar"><button appDel text="Quitar" [label]="'Quitar ' + a.exercise.name" (click)="unassign(a)"></button></span>
                    }
                  </li>
                }
              </ul>
            }
          } @else {
            <app-state kind="empty" title="Sin ejercicios asignados"
              [text]="isPhysio ? 'Asigna ejercicios de movilidad, fuerza o estabilidad a este deportista.' : 'El fisioterapeuta aún no le ha asignado ejercicios.'" />
          }
        </section>

    <app-exercise-dialog [ex]="selected()" (done)="selected.set(null)" />
  `
})
export class AthleteExercises {
  athleteId = input.required<string>();
  athleteName = input.required<string>();
  injuries = input<Injury[]>([]);
  private api = inject(ExerciseApi);
  private fb = inject(NonNullableFormBuilder);
  private toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);
  isPhysio = inject(AuthService).user()?.role === 'PHYSIO';
  iconFor = iconForComponent;
  cls = compClass;
  assignments = signal<Assignment[]>([]);
  aLoading = signal(true);
  aFailed = signal(false);
  assigning = signal(false);
  lib = signal<Exercise[]>([]);
  libLoading = signal(false);
  saving = signal(false);
  aError = signal('');
  selected = signal<ExerciseView | null>(null);
  aForm = this.fb.group({ exerciseId: ['', Validators.required], dosage: [''], note: [''] });
  constructor() { effect(() => { this.athleteId(); this.loadAssignments(); }); }
  groups = computed(() =>
    COMPONENTS.map((c) => ({ c, items: this.assignments().filter((a) => a.exercise.component === c) })).filter(
      (g) => g.items.length
    )
  );
  available = computed(() => {
    const taken = new Set(this.assignments().map((a) => a.exercise.id));
    return this.lib().filter((e) => !taken.has(e.id));
  });
  libGroups = computed(() =>
    COMPONENTS.map((c) => ({ c, items: this.available().filter((e) => e.component === c) })).filter((g) => g.items.length)
  );
  // Ejercicios que apuntan a las zonas donde el deportista ha tenido molestias
  suggested = computed(() => {
    const zs = new Set(this.injuries().map((i) => i.bodyZone));
    return this.available().filter((e) => e.zone && zs.has(e.zone)).slice(0, 6);
  });
  loadAssignments() {
    this.aLoading.set(true);
    this.aFailed.set(false);
    this.api.forAthlete(this.athleteId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (a) => { this.assignments.set(a); this.aLoading.set(false); },
      error: () => { this.aFailed.set(true); this.aLoading.set(false); }
    });
  }

  view(a: Assignment) {
    this.selected.set({ ...a.exercise, dosage: a.dosage ?? a.exercise.dosage, note: a.note });
  }

  openAssign() {
    this.aError.set('');
    this.aForm.reset({ exerciseId: '', dosage: '', note: '' });
    this.assigning.set(true);
    if (!this.lib().length) {
      this.libLoading.set(true);
      this.api.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (l) => { this.lib.set(l); this.libLoading.set(false); },
        error: () => { this.aError.set('No pudimos cargar la biblioteca de ejercicios.'); this.libLoading.set(false); }
      });
    }
  }

  pick(e: Exercise) { this.aForm.controls.exerciseId.setValue(e.id); }

  assign() {
    if (this.saving()) return;
    if (this.aForm.invalid) { this.aForm.markAllAsTouched(); return; }
    const v = this.aForm.getRawValue();
    this.saving.set(true);
    this.aError.set('');
    this.api
      .assign({ athleteId: this.athleteId(), exerciseId: v.exerciseId, dosage: v.dosage.trim() || null, note: v.note.trim() || null })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (a) => {
          this.assignments.update((l) => [a, ...l]);
          this.toast.success('Ejercicio asignado');
          this.saving.set(false);
          this.assigning.set(false);
        },
        error: (e) => { this.aError.set(apiError(e)); this.saving.set(false); }
      });
  }

  async unassign(a: Assignment) {
    const ok = await confirmDialog({
      title: '¿Quitar este ejercicio?',
      text: `${a.exercise.name} dejará de estar asignado a ${this.athleteName()}.`,
      confirmText: 'Quitar',
      danger: true
    });
    if (!ok) return;
    this.api.unassign(a.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.assignments.update((l) => l.filter((x) => x.id !== a.id));
        this.toast.success('Ejercicio quitado');
      },
      error: (e) => this.toast.error(apiError(e))
    });
  }
}
