import { Component, computed, input } from '@angular/core';

const P: Record<string, string[]> = {
  home: ['M4 11l8-7 8 7v9H4z'],
  grid: ['M4 5h7v7H4z', 'M13 5h7v4h-7z', 'M13 11h7v8h-7z', 'M4 14h7v5H4z'],
  chart: ['M4 20V10M10 20V4M16 20v-7M21 20H3'],
  user: ['M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', 'M4 21c1-4 4-6 8-6s7 2 8 6'],
  'user-x': ['M15 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', 'M3 21v-2a6 6 0 0 1 9-5', 'M16 16l6 6M22 16l-6 6'],
  'user-check': ['M15 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', 'M3 21v-2a6 6 0 0 1 9-5', 'M15 19l3 3 5-6'],
  users: ['M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2', 'M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M21 20v-2a4 4 0 0 0-3-3.9', 'M16 2.1a4 4 0 0 1 0 7.8'],
  clipboard: ['M9 4h6v3H9z', 'M7 5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1', 'M9 12h6M9 16h4'],
  'plus-circle': ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z', 'M12 8v8M8 12h8'],
  plus: ['M12 5v14M5 12h14'],
  trash: ['M3 6h18', 'M8 6V4h8v2', 'M6 6l1 14h10l1-14', 'M10 10v7M14 10v7'],
  edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  x: ['M6 6l12 12M18 6L6 18'],
  logout: ['M9 4H5v16h4M16 8l4 4-4 4M20 12H9'],
  play: ['M8 5v14l11-7z'],
  dumbbell: ['M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11'],
  mobility: ['M21 12a9 9 0 1 1-3-6.7L21 8', 'M21 3v5h-5'],
  balance: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
  zap: ['M13 2L4 14h7l-1 8 9-12h-7z'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  link: ['M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7', 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7'],
  download: ['M12 3v12M7 11l5 5 5-5M4 20h16'],
  alert: ['M12 3l9 16H3z', 'M12 10v4M12 17h.01'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5M12 8h.01'],
  image: ['M4 5h16v14H4z', 'M4 16l5-5 4 4 3-3 4 4', 'M9 9.5h.01'],
  video: ['M3 6h12v12H3z', 'M15 10l6-3v10l-6-3'],
  send: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4z'],
  save: ['M5 3h11l3 3v15H5z', 'M8 3v5h7V3', 'M8 21v-7h8v7'],
  lock: ['M6 11h12v10H6z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  'arrow-left': ['M19 12H5M11 6l-6 6 6 6'],
  'user-plus': ['M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M19 8v6M16 11h6'],
  heart: ['M20.8 5.6a5.2 5.2 0 0 0-7.4 0L12 7l-1.4-1.4a5.2 5.2 0 0 0-7.4 7.4L12 21.7l8.8-8.7a5.2 5.2 0 0 0 0-7.4z'],
  calendar: ['M4 6h16v14H4z', 'M4 10h16M8 3v4M16 3v4'],
  sliders: ['M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4'],
  swap: ['M16 3h5v5', 'M21 3l-7 7', 'M8 21H3v-5', 'M3 21l7-7', 'M21 16v5h-5', 'M3 8V3h5']
};

const COMP_ICON: Record<string, string> = { Movilidad: 'mobility', Estabilidad: 'balance', Fuerza: 'dumbbell', 'Técnica': 'zap' };
const COMP_CLASS: Record<string, string> = { Movilidad: 'c-mov', Estabilidad: 'c-est', Fuerza: 'c-fue', 'Técnica': 'c-tec' };

export const iconForComponent = (c: string) => COMP_ICON[c] ?? 'dumbbell';
export const compClass = (c: string) => COMP_CLASS[c] ?? 'c-mov';

@Component({
  selector: 'app-icon',
  template: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">@for (d of paths(); track $index) { <path [attr.d]="d" /> }</svg>`
})
export class Icon {
  name = input.required<string>();
  paths = computed(() => P[this.name()] ?? []);
}
