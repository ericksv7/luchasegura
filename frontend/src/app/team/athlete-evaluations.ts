import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { EvaluationHistory, TeamAthleteApi } from '../core/team-athlete-api';
import { StateView } from '../core/state';

@Component({
  selector: 'app-athlete-evaluations', imports: [DatePipe, StateView],
  template: `
    <div class="cards evaluation-cards">
      <section class="card card-hero span-2" aria-labelledby="evaluation-title">
        <h2 id="evaluation-title">Evaluaciones funcionales</h2>
        <p>Compara los resultados antes y después del programa preventivo. Aquí puedes consultar las mediciones que ya están registradas.</p>
      </section>

      @if (loading()) {
        <div class="sk sk-card" aria-busy="true" aria-label="Cargando evaluación inicial"></div>
        <div class="sk sk-card" aria-busy="true" aria-label="Cargando evaluación final"></div>
      } @else if (failed()) {
        <app-state class="span-2" kind="error" title="No pudimos cargar las evaluaciones" action="Reintentar" (act)="load()" />
      } @else {
        @for (phase of phases(); track phase.id) {
          <section class="card evaluation-phase" [attr.aria-labelledby]="'phase-' + phase.id">
            <p class="eyebrow">{{ phase.moment }}</p>
            <h2 [id]="'phase-' + phase.id">{{ phase.label }}</h2>
            <p class="meta">{{ phase.description }}</p>
            @for (test of phase.tests; track test.id) {
              <details class="evaluation-result">
                <summary>{{ test.testType }} <span class="meta">· {{ test.measuredAt | date:'dd/MM/yyyy HH:mm' }}</span></summary>
                <dl class="rows">
                  @for (field of results(test.result); track $index) {
                    <div><dt>{{ field.label }}</dt><dd>{{ field.value }}</dd></div>
                  } @empty {
                    <div><dt>Resultado</dt><dd>Sin valores registrados</dd></div>
                  }
                </dl>
              </details>
            } @empty {
              <p class="evaluation-empty">Sin mediciones registradas en esta fase.</p>
            }
          </section>
        }
      }

      <section class="card span-2" aria-labelledby="evaluation-availability">
        <h2 id="evaluation-availability">Disponibilidad y validación</h2>
        <dl class="evaluation-guide">
          <div><dt>Disponible ahora</dt><dd>Consulta de mediciones guardadas y sus fechas. Los resultados se muestran tal como fueron registrados.</dd></div>
          <div><dt>Estructura preparada</dt><dd>Registros organizados por prueba y por fase inicial o final.</dd></div>
          <div><dt>Pendiente de validación</dt><dd>La captura se habilitará cuando el equipo académico confirme qué pruebas se aplicarán y defina los protocolos, unidades, puntuación y reglas de registro.</dd></div>
        </dl>
        <details class="evaluation-result">
          <summary>Pruebas contempladas por el proyecto</summary>
          <dl class="evaluation-guide">
            <div><dt>SEBT / YBT-LQ</dt><dd>Equilibrio dinámico de miembros inferiores.</dd></div>
            <div><dt>FMS</dt><dd>Patrones fundamentales de movimiento.</dd></div>
            <div><dt>LESS</dt><dd>Mecánica de aterrizaje.</dd></div>
            <div><dt>Agility T-test</dt><dd>Velocidad y cambios de dirección.</dd></div>
          </dl>
        </details>
      </section>
    </div>`
})
export class AthleteEvaluations {
  athleteId = input.required<string>();
  private api = inject(TeamAthleteApi); private destroyRef = inject(DestroyRef); private request?: Subscription;
  data = signal<EvaluationHistory | null>(null); loading = signal(true); failed = signal(false);
  phases = computed(() => [
    { id: 'INITIAL', label: 'Evaluación inicial', moment: 'Semana 0',
      description: 'Establece el punto de partida antes de iniciar el programa.' },
    { id: 'FINAL', label: 'Evaluación final', moment: 'Al finalizar el programa',
      description: 'Repite las pruebas iniciales para comparar los resultados al cierre.' }
  ].map(phase => ({
    ...phase, tests: this.data()?.tests.filter(test => test.phase === phase.id) ?? []
  })));
  constructor() { effect(() => { this.athleteId(); this.load(); }); }
  results(value: unknown, path: string[] = []): {label: string; value: string}[] {
    if (value !== null && typeof value === 'object') {
      return Object.entries(value).flatMap(([key, entry]) => this.results(entry, [...path, key]));
    }
    return [{label: path.join(' · ') || 'Resultado', value: value === null ? 'Sin valor registrado' : String(value)}];
  }
  load() {
    this.request?.unsubscribe(); this.loading.set(true); this.failed.set(false);
    this.request = this.api.evaluations(this.athleteId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => { this.data.set(data); this.loading.set(false); }, error: () => { this.failed.set(true); this.loading.set(false); }
    });
  }
}
