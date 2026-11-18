import { Component, input } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'button[appEdit]',
  imports: [Icon],
  host: { type: 'button', class: 'edit expand-action', '[attr.aria-label]': 'label()' },
  template: `<app-icon name="edit" /><span class="edit-t expand-label" aria-hidden="true">Editar</span>`
})
export class EditBtn {
  label = input('Editar');
}
