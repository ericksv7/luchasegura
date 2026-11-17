import { Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Icon, compClass, iconForComponent } from './icon';
import { mediaOf } from './exercise-api';

export interface ExerciseView {
  name: string;
  component: string;
  description: string | null;
  dosage: string | null;
  zone: string | null;
  mediaUrl: string | null;
  note?: string | null;
}

@Component({
  selector: 'app-ex-thumb',
  imports: [Icon],
  template: `
    <span [class]="klass()">
      @if (thumb(); as t) {
        <img [src]="t" [alt]="alt()" loading="lazy" referrerpolicy="no-referrer" (error)="failed.set(t)" />
      } @else {
        <app-icon [name]="icon()" />
      }
      @if (video()) { <span class="play" aria-hidden="true"><app-icon name="play" /></span> }
    </span>
  `
})
export class ExThumb {
  component = input.required<string>();
  mediaUrl = input<string | null | undefined>(null);
  alt = input('');
  big = input(false);

  failed = signal<string | null>(null);
  media = computed(() => mediaOf(this.mediaUrl()));
  thumb = computed(() => {
    const t = this.media()?.thumb ?? null;
    return t && t !== this.failed() ? t : null;
  });
  video = computed(() => {
    const k = this.media()?.kind;
    return k === 'youtube' || k === 'vimeo';
  });
  icon = computed(() => iconForComponent(this.component()));
  klass = computed(() => `thumb ${compClass(this.component())}${this.big() ? ' big' : ''}`);
}

@Component({
  selector: 'app-exercise-dialog',
  imports: [Icon],
  template: `
    <dialog #dlg class="dlg" aria-labelledby="dlg-title" (close)="done.emit()" (click)="onClick($event)">
      @if (ex(); as e) {
        <div class="dlg-body">
          <div class="dlg-head">
            <span [class]="'tag comp ' + cls(e.component)"><app-icon [name]="icon(e.component)" /> {{ e.component }}</span>
            <button type="button" class="icon-btn sm" aria-label="Cerrar" (click)="close()"><app-icon name="x" /></button>
          </div>
          <h2 id="dlg-title">{{ e.name }}</h2>

          @if (embed(); as src) {
            <iframe class="dlg-media" [src]="src" [title]="'Video del ejercicio ' + e.name" loading="lazy"
              allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen
              referrerpolicy="strict-origin-when-cross-origin"></iframe>
          } @else if (image(); as img) {
            <img class="dlg-img" [src]="img" [alt]="'Ilustración del ejercicio ' + e.name" referrerpolicy="no-referrer" />
          } @else {
            <div [class]="'dlg-tile ' + cls(e.component)"><app-icon [name]="icon(e.component)" /></div>
          }

          <dl class="rows">
            <div><dt>Dosificación</dt><dd>{{ e.dosage || 'Sin indicar' }}</dd></div>
            @if (e.zone) { <div><dt>Zona</dt><dd>{{ e.zone }}</dd></div> }
            @if (e.note) { <div><dt>Indicación de tu fisioterapeuta</dt><dd>{{ e.note }}</dd></div> }
          </dl>
          @if (e.description) { <p class="dlg-desc">{{ e.description }}</p> }
          <button type="button" class="btn secondary" (click)="close()">Cerrar</button>
        </div>
      }
    </dialog>
  `
})
export class ExerciseDialog {
  private san = inject(DomSanitizer);

  ex = input<ExerciseView | null>(null);
  done = output<void>();
  private dlg = viewChild<ElementRef<HTMLDialogElement>>('dlg');

  media = computed(() => mediaOf(this.ex()?.mediaUrl));
  // La dirección del video se arma aquí a partir de un identificador ya validado
  embed = computed<SafeResourceUrl | null>(() => {
    const m = this.media();
    return m?.embed ? this.san.bypassSecurityTrustResourceUrl(m.embed) : null;
  });
  image = computed(() => (this.media()?.kind === 'image' ? this.media()!.src : null));

  cls = compClass;
  icon = iconForComponent;

  constructor() {
    effect(() => {
      const d = this.dlg()?.nativeElement;
      const e = this.ex();
      if (!d) return;
      if (e && !d.open) d.showModal();
      else if (!e && d.open) d.close();
    });
  }

  close() { this.dlg()?.nativeElement.close(); }
  onClick(ev: MouseEvent) {
    if (ev.target === this.dlg()?.nativeElement) this.close();
  }
}