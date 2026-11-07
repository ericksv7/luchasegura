import { Component } from '@angular/core';

// Marco compartido de login y registro
@Component({
  selector: 'app-auth-shell',
  template: `
    <main class="split">
      <aside class="brand">
        <div class="brand-logo">
          <span class="mark">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M8.5 12l2.5 2.5L16 9.5" />
            </svg>
          </span>
          LuchaSegura
        </div>
        <div>
          <h2>Prevención de lesiones en lucha olímpica</h2>
          <p>Registro de molestias, programa preventivo y seguimiento para deportistas, entrenadores y fisioterapeutas.</p>
        </div>
        <small>Universidad del Rosario · IDRD</small>
      </aside>
      <section class="form-side">
        <div class="form-wrap">
          <div class="logo-sm">
            <span class="mark">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M8.5 12l2.5 2.5L16 9.5" />
              </svg>
            </span>
            LuchaSegura
          </div>
          <ng-content />
        </div>
      </section>
    </main>
  `
})
export class AuthShell {}