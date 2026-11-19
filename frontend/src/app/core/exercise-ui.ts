import { Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { Icon, compClass, iconForComponent } from './icon';
import { ExerciseDetails, exerciseCategoryLabel } from './exercise-api';

export interface ExerciseView extends ExerciseDetails {
  note?: string | null;
  status?: string;
  assignedDosage?: string | null;
}

@Component({
  selector: 'app-ex-thumb',
  styles: `
    .exercise-visual img { object-fit: contain; }
    .exercise-visual--card, .exercise-visual--detail {
      width: 100%; height: auto; aspect-ratio: 2 / 1;
      align-content: center; gap: 8px; text-align: center;
    }
    .exercise-visual--detail { aspect-ratio: 2 / 1; max-height: 42dvh; }
    .exercise-visual--detail .ic { width: 36px; height: 36px; }
  `,
  imports: [Icon],
  template: `
    <span [class]="klass()">
      @if (image(); as src) {
        <img [src]="src" [alt]="alt()" loading="lazy" (error)="failed.set(src)" />
      } @else {
        <app-icon [name]="icon()" />
        @if (mode() === 'detail') { <span>Ilustración no disponible</span> }
      }
    </span>
  `
})
export class ExThumb {
  component = input.required<string>();
  illustration = input<string | null | undefined>(null);
  alt = input('');
  mode = input<'thumb' | 'card' | 'detail'>('thumb');
  protected failed = signal<string | null>(null);
  protected image = computed(() => this.illustration() !== this.failed() ? this.illustration() : null);
  protected icon = computed(() => iconForComponent(this.component()));
  protected klass = computed(() => `thumb exercise-visual exercise-visual--${this.mode()} ${compClass(this.component())}`);
}

@Component({
  selector: 'app-exercise-dialog',
  styles: `
    .exercise-sheet { width: min(660px, calc(100vw - 24px)); }
    .exercise-facts {
      margin: 0; display: grid; gap: 8px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .exercise-facts div, .exercise-note {
      border-radius: var(--r); padding: 10px 12px; background: var(--surf2);
    }
    dt { color: var(--mute); font-size: .85rem; }
    dd { margin: 3px 0 0; font-weight: 650; }
    .exercise-note { border-inline-start: 3px solid var(--pri); }
    h3 { margin: 0 0 4px; font-size: 1rem; }
    p, ol { margin: 0; }
    ol { padding-inline-start: 1.4em; }
    li + li { margin-top: 6px; }
  `,
  imports: [Icon, ExThumb],
  template: `
    <dialog #dlg class="dlg exercise-sheet" aria-labelledby="exercise-sheet-title" (close)="done.emit()" (click)="onClick($event)">
      @if (ex(); as e) {
        <div class="dlg-body">
          <div class="dlg-head">
            <span [class]="'tag comp ' + cls(e.component)"><app-icon [name]="icon(e.component)" /> {{ categoryLabel(e.component) }}</span>
            <button type="button" class="icon-btn sm" aria-label="Cerrar ficha" (click)="close()"><app-icon name="x" /></button>
          </div>
          <div>
            <h2 id="exercise-sheet-title">{{ e.name }}</h2>
            @if (e.status) { <p class="meta">{{ e.status }}</p> }
          </div>

          <app-ex-thumb mode="detail" [component]="e.component" [illustration]="e.illustration"
            [alt]="'Posturas de ' + e.name" />

          <dl class="exercise-facts">
            @if (e.dosage && !e.assignedDosage) { <div><dt>Series o repeticiones orientativas</dt><dd>{{ e.dosage }}</dd></div> }
            <div><dt>Implementos</dt><dd>{{ e.equipment || 'Sin indicar' }}</dd></div>
            @if (e.zone) { <div><dt>Zona</dt><dd>{{ e.zone }}</dd></div> }
            @if (e.level) { <div><dt>Nivel</dt><dd>{{ e.level }}</dd></div> }
          </dl>

          @if (e.note || e.assignedDosage) {
            <section class="exercise-note">
              <h3>Indicación de fisioterapia</h3>
              @if (e.assignedDosage) { <p><strong>Series o repeticiones asignadas</strong> · {{ e.assignedDosage }}</p> }
              @if (e.note) { <p>{{ e.note }}</p> }
            </section>
          }
          @if (e.objective) {
            <section><h3>Para qué sirve</h3><p>{{ e.objective }}</p></section>
          }
          @if (steps().length || e.description) {
            <section>
              <h3>Cómo se hace</h3>
              @if (e.description && steps().length) { <p>{{ e.description }}</p> }
              @if (steps().length) {
                <ol>
                  @for (step of steps(); track $index) { <li>{{ step }}</li> }
                </ol>
              } @else {
                <p class="dlg-desc">{{ e.description }}</p>
              }
            </section>
          }
          @if (e.mistakes) { <section><h3>Errores comunes</h3><p>{{ e.mistakes }}</p></section> }
          @if (e.precautions) { <section><h3>Precauciones</h3><p>{{ e.precautions }}</p></section> }
          <footer><button type="button" class="btn secondary" (click)="close()">Cerrar</button></footer>
        </div>
      }
    </dialog>
  `
})
export class ExerciseDialog {
  ex = input<ExerciseView | null>(null);
  done = output<void>();
  private dlg = viewChild<ElementRef<HTMLDialogElement>>('dlg');

  protected steps = computed(() => (this.ex()?.instructions ?? '').split('\n').map(step => step.trim()).filter(Boolean));
  protected cls = compClass;
  protected categoryLabel = exerciseCategoryLabel;
  protected icon = iconForComponent;

  constructor() {
    effect(() => {
      const dialog = this.dlg()?.nativeElement;
      const exercise = this.ex();
      if (!dialog) return;
      if (exercise && !dialog.open) dialog.showModal();
      else if (!exercise && dialog.open) dialog.close();
    });
  }

  protected close() { this.dlg()?.nativeElement.close(); }
  protected onClick(event: MouseEvent) {
    if (event.target === this.dlg()?.nativeElement) this.close();
  }
}
