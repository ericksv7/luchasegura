import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface SectionItem { id: string; label: string; }

@Component({
  selector: 'app-section-nav',
  imports: [RouterLink],
  template: `
    <nav class="section-nav" [attr.aria-label]="label()">
      @for (item of items(); track item.id) {
        <a [id]="'section-' + item.id" [routerLink]="[]" [queryParams]="{ tab: item.id }" queryParamsHandling="merge"
          [class.on]="active() === item.id" [attr.aria-current]="active() === item.id ? 'page' : null">{{ item.label }}</a>
      }
    </nav>
  `
})
export class SectionNav {
  items = input.required<SectionItem[]>();
  active = input.required<string>();
  label = input('Secciones de la ficha');
}
