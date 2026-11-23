import { Component, input, model, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { formatHistoryDay } from '../core/civil-date';
import { WellbeingEntry, WellbeingValues } from '../core/wellbeing-api';

@Component({
  selector: 'section[appWellbeingEvolution]',
  imports: [NgTemplateOutlet],
  templateUrl: './wellbeing-evolution.html',
  styleUrl: './wellbeing-evolution.scss',
})
export class WellbeingEvolution {
  private readonly chartDate = new Intl.DateTimeFormat('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
  week = model('');
  weekOptions = input.required<[string, string][]>();
  evolution = input.required<WellbeingEntry[]>();
  sleepSeries = input.required<WellbeingEntry[]>();
  loading = input.required<boolean>();
  failed = input.required<boolean>();
  answers = input.required<TemplateRef<{ $implicit: WellbeingValues }>>();
  formatHours = input.required<(hours: number) => string>();
  readonly formatDay = formatHistoryDay;

  formatChartDay(day: string) {
    return this.chartDate.formatToParts(new Date(day))
      .filter(part => part.type !== 'literal').map(part => part.value).join(' ');
  }
}
