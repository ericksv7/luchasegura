import { Component, input } from '@angular/core';
import { formatHistoryDay } from './civil-date';
import { fatigueLabels, recoveryLabels, restLabels, WellbeingEntry } from './wellbeing-api';

@Component({
  selector: 'app-wellbeing-snapshot',
  template: `
    @let record = entry();
    <p class="context"><time [attr.datetime]="record.day">{{ formatDay(record.day) }}</time>
      <span>Semana {{ record.week }} · {{ record.program.name }}</span></p>
    <dl>
      <div class="sleep">
        <dt>Horas de sueño</dt>
        @if (record.current.sleepHours !== null) {
          <dd class="hours">{{ hours.format(record.current.sleepHours) }} <span>h</span></dd>
          @if (showScale()) {
            <dd class="sleep-scale">
              <meter min="0" max="24" [value]="record.current.sleepHours" aria-label="Horas registradas en una escala de 0 a 24"></meter>
              <small aria-hidden="true"><span>0 h</span><span>24 h</span></small>
            </dd>
          }
        } @else {
          <dd>Sin responder</dd>
        }
      </div>
      <div><dt>Descanso</dt><dd>{{ record.current.rest ? restLabels[record.current.rest] : 'Sin responder' }}</dd></div>
      <div><dt>Fatiga</dt><dd>{{ record.current.fatigue ? fatigueLabels[record.current.fatigue] : 'Sin responder' }}</dd></div>
      <div><dt>Recuperación</dt><dd>{{ record.current.recovery ? recoveryLabels[record.current.recovery] : 'Sin responder' }}</dd></div>
    </dl>
  `,
  styles: [`
    :host { display: block; min-inline-size: 0; container-type: inline-size; }
    .context { display: flex; flex-wrap: wrap; gap: .1rem .55rem; font-size: var(--text-message); margin: .35rem 0 .85rem; overflow-wrap: anywhere; }
    .context time { font-weight: 750; color: var(--ink); }
    dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .65rem .8rem; margin: 0; }
    .sleep { grid-column: 1 / -1; }
    dt { color: var(--mute); font-size: var(--text-message); }
    dd { margin: 0; font-weight: 700; overflow-wrap: anywhere; }
    .hours { color: var(--pri); font-size: clamp(1.7rem, 1.5rem + 1.3vw, 2.5rem); line-height: 1.18; font-weight: 850; font-variant-numeric: tabular-nums; }
    .hours span { font-size: .65em; }
    .sleep-scale { max-inline-size: 27rem; margin-block-start: .3rem; }
    meter { display: block; inline-size: 100%; block-size: .8rem; appearance: none; }
    meter::-webkit-meter-bar { background: var(--surf2); border: 1px solid var(--control-line); border-radius: .25rem; }
    meter::-webkit-meter-optimum-value { background: var(--pri); border-radius: .2rem; }
    meter::-moz-meter-bar { background: var(--pri); }
    @container (max-width: 22rem) { dl { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    small { display: flex; justify-content: space-between; color: var(--mute); font-size: var(--text-label); }
  `],
})
export class WellbeingSnapshot {
  readonly entry = input.required<WellbeingEntry>();
  readonly showScale = input(false);
  readonly formatDay = formatHistoryDay;
  readonly restLabels = restLabels;
  readonly fatigueLabels = fatigueLabels;
  readonly recoveryLabels = recoveryLabels;
  readonly hours = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });
}
