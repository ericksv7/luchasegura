import { Component } from '@angular/core';
import { Logo } from './logo';

// Marco compartido de login y registro
@Component({
  selector: 'app-auth-shell',
  imports: [Logo],
  template: `
    <main class="split">
      <aside class="brand">
        <app-logo [size]="44" />
        <div>
          <h2>Prevención de lesiones en lucha olímpica</h2>
          <p>Registro de molestias, programa preventivo y seguimiento para deportistas, entrenadores y fisioterapeutas.</p>
        </div>
        <small>Universidad del Rosario · IDRD</small>
      </aside>
      <section class="form-side">
        <div class="form-wrap">
          <div class="logo-sm"><app-logo [size]="34" /></div>
          <ng-content />
        </div>
      </section>
    </main>
  `
})
export class AuthShell {}