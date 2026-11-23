import { Component, computed, input } from '@angular/core';
import type { Answers, Catalogue } from './surveys.page';

@Component({
  selector: 'app-survey-review',
  template: `
    @for (group of groups(); track group.name) {
      <section class="answer-group">
        <h3>{{ group.name }}</h3>
        <dl>
          @for (question of group.answered; track question.id) {
            <div><dt>{{ question.label }}</dt>
              <dd>{{ question.value }}
                @if (question.invalid) { <strong class="msg"> · Requiere revisión</strong> }
              </dd>
            </div>
          } @empty { <div><dt class="sr-only">Respuestas</dt><dd>Sin respuestas en esta sección.</dd></div> }
        </dl>
      </section>
    }
    @if (omitted().length) {
      <details class="disclosure">
        <summary>Preguntas opcionales sin responder ({{ omitted().length }})</summary>
        <ul>
          @for (question of omitted(); track question.id) { <li>{{ question.label }}</li> }
        </ul>
      </details>
    }
  `,
  styles: [`
    :host { display: block; padding-block: .5rem; }
    .answer-group { border-block-start: 1px solid var(--line); padding-block: .7rem; }
    h3 { margin: 0 0 .25rem; font-size: 1rem; }
    dl { margin: 0; }
    dl > div { padding-block: .25rem; }
    dt { font-weight: 650; }
    dd { margin: 0; white-space: pre-wrap; }
  `],
})
export class SurveyReview {
  readonly catalogue = input.required<Catalogue>();
  readonly answers = input.required<Answers>();
  readonly invalid = input<string[]>([]);
  private readonly items = computed(() => {
    const answers = this.answers();
    return this.catalogue().questions.filter(question => !question.when || answers[question.when] === 'yes')
      .map(question => {
        const value = answers[question.id];
        const invalid = this.invalid().includes(question.id);
        return {
          ...question, invalid, show: value !== undefined || question.required || invalid,
          value: value === undefined ? 'Sin responder' : question.options?.find(([id]) => id === value)?.[1] ?? String(value),
        };
      });
  });
  readonly groups = computed(() => [...new Set(this.items().map(item => item.group))].map(name => ({
    name, answered: this.items().filter(item => item.group === name && item.show),
  })));
  readonly omitted = computed(() => this.items().filter(item => !item.show));
}
