import { Component, input } from '@angular/core';
import { Icon } from './icon';

// Botón de eliminar: basurita que despliega el texto y se pone rojo al pasar el mouse
@Component({
  selector: 'button[appDel]',
  imports: [Icon],
  host: { type: 'button', class: 'del expand-action', '[attr.aria-label]': 'label()' },
  template: `<app-icon name="trash" /><span class="del-t expand-label" aria-hidden="true">{{ text() }}</span>`
})
export class DelBtn {
  label = input.required<string>();
  text = input('Eliminar');
}