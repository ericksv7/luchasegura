import { Component, effect, ElementRef, input, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface SectionItem { id: string; label: string; }

@Component({
  selector: 'app-section-nav',
  imports: [RouterLink],
  template: `
    <nav #rail class="section-nav" [attr.aria-label]="label()">
      @for (item of items(); track item.id) {
        <a [id]="'section-' + item.id" [routerLink]="[]" [queryParams]="{ tab: item.id }" queryParamsHandling="merge"
          [class.on]="active() === item.id" [attr.aria-current]="active() === item.id ? 'page' : null">{{ item.label }}</a>
      }
    </nav>
  `,
  styles: [`
    .section-nav {
      display: flex; gap: 6px; margin-block-end: 20px;
      overflow-x: auto; scrollbar-width: thin;
    }
    a {
      display: inline-flex; flex: none; align-items: center; justify-content: center;
      min-block-size: var(--h); padding: 7px 10px; white-space: nowrap;
      font-size: var(--text-message); color: var(--mute); text-decoration: none;
      border: 1px solid var(--line); border-radius: var(--r);
      transition: background-color var(--motion-control), color var(--motion-control);
    }
    a:hover:not(.on) { background: var(--surf2); color: var(--ink); }
    a:active:not(.on) { background: var(--line); }
    a.on { color: var(--pri); background: var(--soft); border-color: var(--pri); }
    a:focus-visible { outline-offset: -3px; border-radius: var(--r); }
    @media (min-width: 900px) {
      a { flex: 1 1 auto; min-inline-size: min-content; white-space: normal; text-align: center; }
    }
  `],
})
export class SectionNav {
  items = input.required<SectionItem[]>();
  active = input.required<string>();
  label = input('Secciones de la ficha');
  private readonly rail = viewChild<ElementRef<HTMLElement>>('rail');

  constructor() {
    effect(onCleanup => {
      const active = this.active();
      const rail = this.rail()?.nativeElement;
      if (!rail) return;

      const reveal = () => {
        const link = rail.querySelector<HTMLElement>('#section-' + active);
        if (!link) return;
        const { left, right } = rail.getBoundingClientRect();
        const selected = link.getBoundingClientRect();
        if (selected.left < left) rail.scrollLeft += selected.left - left;
        else if (selected.right > right) rail.scrollLeft += selected.right - right;
      };
      const observer = new ResizeObserver(reveal);
      observer.observe(rail);
      reveal();
      onCleanup(() => observer.disconnect());
    });
  }
}
