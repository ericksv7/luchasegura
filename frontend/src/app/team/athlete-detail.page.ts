import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, apiError } from '../core/auth.service';
import { Injury, LIMIT_LABEL, PAIN_LABEL, fmtDate, painLevel, since } from '../core/athlete-store';
import { BarChart, ChartPoint, LineChart, ProgressRing } from '../core/charts';
import { confirmDialog } from '../core/confirm';
import { Assignment, COMPONENTS, Exercise, ExerciseApi } from '../core/exercise-api';
import { ExThumb, ExerciseDialog, ExerciseView } from '../core/exercise-ui';
import { Icon, compClass, iconForComponent } from '../core/icon';
import { StateView } from '../core/state';
import { ToastService } from '../core/toast.service';
import { DelBtn } from '../core/del-btn';

interface Detail {
  id: string;
  name: string;
  email: string;
  coachName: string | null;
  profile: {
    birthDate: string | null;
    weightKg: string | number | null;
    category: string | null;
    style: string | null;
    yearsExperience: number | null;
    notes: string | null;
  };
  program: { weeks: number; sessionsPerWeek: number; currentWeek: number } | null;
  compliance: number;
  planned: number;
  done: number;
  weekBars: { week: number; done: number }[];
  injuries: Injury[];
}

@Component({
  selector: 'app-athlete-detail',
  imports: [RouterLink, ReactiveFormsModule, ProgressRing, LineChart, BarChart, StateView, Icon, ExThumb, ExerciseDialog, DelBtn],
  template: `
    <a class="back" routerLink="/equipo/deportistas"><app-icon name="arrow-left" /> Deportistas</a>

    @if (failed()) {
      <app-state kind="error" [title]="notFound() ? 'No encontramos a este deportista' : 'No pudimos cargar la ficha'"
        [text]="notFound() ? 'Puede que no esté asignado a tu cuenta.' : 'Revisa tu conexión e inténtalo de nuevo.'"
        [action]="notFound() ? 'Volver a la lista' : 'Reintentar'" (act)="notFound() ? back() : load()" />
    } @else if (loading()) {
      <div class="cards" aria-busy="true" aria-label="Cargando">
        <div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-card"></div>
        <div class="sk sk-chart span-2"></div>
      </div>
    } @else if (d(); as d) {
      <header class="page-head">
        <h1>{{ d.name }}</h1>
        <p class="sub">{{ subtitle() }}</p>
      </header>

      <div class="cards">
        <section class="card" aria-labelledby="d-c">
          <h2 id="d-c">Cumplimiento</h2>
          @if (d.program) {
            <div class="ring-row">
              <app-progress-ring [value]="d.compliance"
                [ariaLabel]="'Cumplimiento del programa: ' + d.compliance + ' por ciento'" />
              <p class="ring-meta"><strong>{{ d.done }} de {{ d.planned }}</strong> sesiones hasta hoy</p>
            </div>
          } @else {
            <p class="meta">No hay un programa asignado.</p>
          }
        </section>

        <section class="card" aria-labelledby="d-r">
          <h2 id="d-r">Resumen</h2>
          <dl class="stats">
            <div><dt>Semana actual</dt><dd>{{ d.program ? d.program.currentWeek : '—' }}</dd></div>
            <div><dt>Reportes de molestias</dt><dd>{{ reports().length }}</dd></div>
            <div><dt>Antecedentes</dt><dd>{{ history().length }}</dd></div>
          </dl>
        </section>

        <section class="card" aria-labelledby="d-g">
          <h2 id="d-g">Datos generales</h2>
          <dl class="rows">
            <div><dt>Edad</dt><dd>{{ age() !== null ? age() + ' años' : 'Sin registrar' }}</dd></div>
            <div><dt>Peso</dt><dd>{{ d.profile.weightKg ? (+d.profile.weightKg) + ' kg' : 'Sin registrar' }}</dd></div>
            <div><dt>Categoría</dt><dd>{{ d.profile.category || 'Sin registrar' }}</dd></div>
            <div><dt>Estilo</dt><dd>{{ d.profile.style || 'Sin registrar' }}</dd></div>
            <div><dt>Experiencia</dt><dd>{{ d.profile.yearsExperience !== null ? d.profile.yearsExperience + ' años' : 'Sin registrar' }}</dd></div>
            <div><dt>Entrenador</dt><dd>{{ d.coachName || 'Sin asignar' }}</dd></div>
          </dl>
        </section>

        <section class="card span-2" aria-labelledby="d-e">
          <div class="card-head">
            <h2 id="d-e">Ejercicios asignados</h2>
            @if (isPhysio && !assigning()) {
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

        <section class="card span-2" aria-labelledby="d-s">
          <h2 id="d-s">Sesiones por semana</h2>
          @if (d.program) {
            <p class="meta">La línea punteada marca la meta de {{ d.program.sessionsPerWeek }} sesiones.</p>
            <app-bar-chart [bars]="bars()" [max]="d.program.sessionsPerWeek" [target]="d.program.sessionsPerWeek"
              ariaLabel="Sesiones completadas por semana del programa" />
          } @else {
            <app-state kind="empty" title="Sin programa asignado" />
          }
        </section>

        <section class="card span-2" aria-labelledby="d-d">
          <h2 id="d-d">Evolución del dolor</h2>
          @if (zones().length) {
            <div class="chips" role="group" aria-label="Zona del cuerpo">
              @for (z of zones(); track z) {
                <button type="button" class="chip" [class.on]="zone() === z" [attr.aria-pressed]="zone() === z"
                  (click)="zoneSel.set(z)">{{ z }}</button>
              }
            </div>
            <app-line-chart [points]="pain()" [max]="10" [ariaLabel]="'Evolución del dolor en ' + zone() + ', de 0 a 10'" />
          } @else {
            <app-state kind="empty" title="Sin reportes de dolor"
              text="Cuando este deportista reporte molestias, verás aquí su evolución." />
          }
        </section>

        <section class="card span-2" aria-labelledby="d-h">
          <div class="card-head">
            <h2 id="d-h">Historial</h2>
            @if (isPhysio) { <a class="btn secondary sm" routerLink="/equipo/alertas" [queryParams]="{ athleteId: d.id, status: 'ALL' }">Alertas y revisiones</a> }
          </div>
          @if (d.injuries.length) {
            <ul class="list">
              @for (i of d.injuries; track i.id) {
                <li>
                  <div>
                    <strong>{{ i.bodyZone }}{{ i.injuryType ? ' · ' + i.injuryType : '' }}</strong>
                    <small>
                      {{ i.isHistory ? 'Antecedente · ' + since(i.occurredAt) : date(i.occurredAt) + ' · ' + limit(i.limitation) }}
                    </small>
                  </div>
                  @if (!i.isHistory && i.intensity !== null) {
                    <span [class]="'badge ' + level(i.intensity)">{{ label(i.intensity) }} · {{ i.intensity }}/10</span>
                  } @else if (i.recurrent) {
                    <span class="badge mid">Recurrente</span>
                  }
                </li>
              }
            </ul>
          } @else {
            <app-state kind="empty" title="Sin historial" text="Aún no hay reportes ni antecedentes registrados." />
          }
        </section>
      </div>
    }

    <app-exercise-dialog [ex]="selected()" (done)="selected.set(null)" />
  `
})
export class AthleteDetailPage {
  private http = inject(HttpClient);
  private router = inject(Router);
  private api = inject(ExerciseApi);
  private fb = inject(NonNullableFormBuilder);
  private toast = inject(ToastService);
  private id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  isPhysio = inject(AuthService).user()?.role === 'PHYSIO';
  iconFor = iconForComponent;
  cls = compClass;

  d = signal<Detail | null>(null);
  loading = signal(true);
  failed = signal(false);
  notFound = signal(false);
  zoneSel = signal<string | null>(null);

  assignments = signal<Assignment[]>([]);
  aLoading = signal(true);
  aFailed = signal(false);
  assigning = signal(false);
  lib = signal<Exercise[]>([]);
  libLoading = signal(false);
  saving = signal(false);
  aError = signal('');
  selected = signal<ExerciseView | null>(null);

  aForm = this.fb.group({
    exerciseId: ['', Validators.required],
    dosage: [''],
    note: ['']
  });

  reports = computed(() =>
    (this.d()?.injuries ?? []).filter((i) => !i.isHistory).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  );
  history = computed(() => (this.d()?.injuries ?? []).filter((i) => i.isHistory));
  zones = computed(() => {
    const seen: string[] = [];
    for (const r of [...this.reports()].reverse()) {
      if (r.intensity !== null && !seen.includes(r.bodyZone)) seen.push(r.bodyZone);
    }
    return seen;
  });
  zone = computed(() => this.zoneSel() ?? this.zones()[0] ?? null);
  pain = computed<ChartPoint[]>(() =>
    this.reports()
      .filter((r) => r.bodyZone === this.zone() && r.intensity !== null)
      .map((r) => ({ label: fmtDate(r.occurredAt), value: r.intensity as number }))
  );
  bars = computed<ChartPoint[]>(() => (this.d()?.weekBars ?? []).map((b) => ({ label: `S${b.week}`, value: b.done })));
  subtitle = computed(() => {
    const p = this.d()?.profile;
    return [p?.category, p?.style].filter(Boolean).join(' · ') || (this.d()?.email ?? '');
  });
  age = computed(() => {
    const b = this.d()?.profile.birthDate;
    if (!b) return null;
    const bd = new Date(b), n = new Date();
    let a = n.getFullYear() - bd.getFullYear();
    const m = n.getMonth() - bd.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < bd.getDate())) a--;
    return a;
  });

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
    const zs = new Set((this.d()?.injuries ?? []).map((i) => i.bodyZone));
    return this.available().filter((e) => e.zone && zs.has(e.zone)).slice(0, 6);
  });

  level = painLevel;
  label(n: number) { return PAIN_LABEL[painLevel(n)]; }
  limit(l: Injury['limitation']) { return LIMIT_LABEL[l]; }
  date = fmtDate;
  since = since;

  constructor() {
    this.load();
    this.loadAssignments();
  }

  back() { this.router.navigateByUrl('/equipo/deportistas'); }

  load() {
    this.loading.set(true);
    this.failed.set(false);
    this.notFound.set(false);
    this.http.get<Detail>(`/api/team/athletes/${this.id}`).subscribe({
      next: (d) => { this.d.set(d); this.loading.set(false); },
      error: (e) => {
        this.notFound.set(e?.status === 404);
        this.failed.set(true);
        this.loading.set(false);
      }
    });
  }

  loadAssignments() {
    this.aLoading.set(true);
    this.aFailed.set(false);
    this.api.forAthlete(this.id).subscribe({
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
      this.api.list().subscribe({
        next: (l) => { this.lib.set(l); this.libLoading.set(false); },
        error: () => { this.aError.set('No pudimos cargar la biblioteca de ejercicios.'); this.libLoading.set(false); }
      });
    }
  }

  pick(e: Exercise) { this.aForm.controls.exerciseId.setValue(e.id); }

  assign() {
    if (this.aForm.invalid) { this.aForm.markAllAsTouched(); return; }
    const v = this.aForm.getRawValue();
    this.saving.set(true);
    this.aError.set('');
    this.api
      .assign({ athleteId: this.id, exerciseId: v.exerciseId, dosage: v.dosage.trim() || null, note: v.note.trim() || null })
      .subscribe({
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
      text: `${a.exercise.name} dejará de estar asignado a ${this.d()?.name ?? 'este deportista'}.`,
      confirmText: 'Quitar',
      danger: true
    });
    if (!ok) return;
    this.api.unassign(a.id).subscribe({
      next: () => {
        this.assignments.update((l) => l.filter((x) => x.id !== a.id));
        this.toast.success('Ejercicio quitado');
      },
      error: (e) => this.toast.error(apiError(e))
    });
  }
}