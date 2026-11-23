import { RouterLink } from '@angular/router';
import { Component, input } from '@angular/core';
import { Logo } from './logo';

// Marco compartido de login y registro
@Component({
  selector: 'app-auth-shell',
  imports: [Logo, RouterLink],
  template: `
    <main class="split" [class.split-flow]="formFlow()">
      <aside class="brand">
        <div class="brand-content">
          <app-logo [size]="44" />
          <div>
            <h2>Prevención de lesiones en lucha olímpica</h2>
            <p>Registro de molestias, programa preventivo y seguimiento para deportistas, entrenadores y fisioterapeutas.</p>
          </div>
          <small>Universidad del Rosario · IDRD</small>
        </div>
      </aside>
      <section class="form-side">
        <div class="form-wrap">
          <div class="logo-sm"><app-logo [size]="34" /></div>
          <ng-content />
          <footer class="alt"><a routerLink="/informacion-legal">Privacidad, uso y accesibilidad</a></footer>
        </div>
      </section>
    </main>
  `,
  styleUrl: './auth-shell.scss',
})
export class AuthShell {
  formFlow = input(false);
}
