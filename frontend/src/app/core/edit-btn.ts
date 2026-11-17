import { Component } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'button[appEdit]',
  imports: [Icon],
  host: { type: 'button', class: 'edit', 'aria-label': 'Editar' },
  template: `<app-icon name="edit" /><span class="edit-t" aria-hidden="true">Editar</span>`
})
export class EditBtn {}
