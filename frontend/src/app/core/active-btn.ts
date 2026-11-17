import { Component, computed, input } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'button[appActive]',
  imports: [Icon],
  host: {
    type: 'button', class: 'active-btn',
    '[class.deactivate]': 'active()',
    '[attr.aria-label]': 'text() + " a " + userName()'
  },
  template: `<app-icon [name]="active() ? 'user-x' : 'user-check'" /><span class="active-t" aria-hidden="true">{{ text() }}</span>`
})
export class ActiveBtn {
  active = input.required<boolean>();
  userName = input.required<string>();
  text = computed(() => this.active() ? 'Desactivar' : 'Activar');
}
