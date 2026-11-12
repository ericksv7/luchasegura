import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';

export interface ChartPoint { label: string; value: number; }

const H = 190, L = 32, R = 28, T = 12, B = 30;
const IH = H - T - B;

// Mide el ancho real de la tarjeta y lo mantiene actualizado al cambiar el tamaño de la ventana
function watchWidth(min = 260) {
  const host = inject<ElementRef<HTMLElement>>(ElementRef);
  const destroyRef = inject(DestroyRef);
  const w = signal(320);
  afterNextRender(() => {
    const read = () => w.set(Math.max(min, Math.round(host.nativeElement.clientWidth)));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(host.nativeElement);
    destroyRef.onDestroy(() => ro.disconnect());
  });
  return w;
}

@Component({
  selector: 'app-progress-ring',
  template: `
    <svg viewBox="0 0 100 100" class="ring" role="img" [attr.aria-label]="ariaLabel()">
      <circle cx="50" cy="50" r="42" class="ring-bg" />
      <circle cx="50" cy="50" r="42" class="ring-fg" [attr.stroke-dasharray]="dash()" transform="rotate(-90 50 50)" />
      <text x="50" y="50" class="ring-text" text-anchor="middle" dominant-baseline="central">{{ value() }}%</text>
    </svg>
  `
})
export class ProgressRing {
  value = input.required<number>();
  ariaLabel = input('Porcentaje de cumplimiento');
  private readonly C = 2 * Math.PI * 42;
  dash = computed(() => {
    const v = Math.max(0, Math.min(100, this.value()));
    return `${(v / 100) * this.C} ${this.C}`;
  });
}

@Component({
  selector: 'app-line-chart',
  host: { style: 'display:block' },
  template: `
    <svg [attr.viewBox]="'0 0 ' + w() + ' ' + H" class="chart" role="img" [attr.aria-label]="ariaLabel()">
      @for (t of ticks(); track t.v) {
        <line [attr.x1]="L" [attr.x2]="w() - R" [attr.y1]="t.y" [attr.y2]="t.y" class="c-grid" />
        <text [attr.x]="L - 8" [attr.y]="t.y" class="c-axis" text-anchor="end" dominant-baseline="central">{{ t.v }}</text>
      }
      @if (coords().length > 1) {
        <polyline [attr.points]="path()" class="c-line" fill="none" />
      }
      @for (c of coords(); track $index) {
        <circle [attr.cx]="c.x" [attr.cy]="c.y" r="4.5" class="c-dot"><title>{{ c.label }}: {{ c.value }}</title></circle>
        @if (showLabel($index)) {
          <text [attr.x]="c.x" [attr.y]="H - 10" class="c-axis" text-anchor="middle">{{ c.label }}</text>
        }
      }
    </svg>
  `
})
export class LineChart {
  points = input.required<ChartPoint[]>();
  max = input(10);
  ariaLabel = input('Gráfica de evolución');

  readonly w = watchWidth();
  readonly H = H; readonly L = L; readonly R = R;

  private iw = computed(() => this.w() - L - R);

  ticks = computed(() => {
    const m = this.max();
    return [0, m / 2, m].map((v) => ({ v, y: T + IH * (1 - v / m) }));
  });
  coords = computed(() => {
    const p = this.points(), m = this.max(), n = p.length, iw = this.iw();
    return p.map((d, i) => ({
      label: d.label,
      value: d.value,
      x: n === 1 ? L + iw / 2 : L + (iw * i) / (n - 1),
      y: T + IH * (1 - Math.min(d.value, m) / m)
    }));
  });
  path = computed(() => this.coords().map((c) => `${c.x},${c.y}`).join(' '));

  // Muestra solo las etiquetas que caben sin encimarse
  showLabel(i: number) {
    const n = this.points().length;
    const fit = Math.max(2, Math.floor(this.iw() / 70));
    const step = Math.max(1, Math.ceil(n / fit));
    return i % step === 0;
  }
}

@Component({
  selector: 'app-bar-chart',
  host: { style: 'display:block' },
  template: `
    <svg [attr.viewBox]="'0 0 ' + w() + ' ' + H" class="chart" role="img" [attr.aria-label]="ariaLabel()">
      @for (t of ticks(); track t.v) {
        <line [attr.x1]="L" [attr.x2]="w() - R" [attr.y1]="t.y" [attr.y2]="t.y" class="c-grid" />
        <text [attr.x]="L - 8" [attr.y]="t.y" class="c-axis" text-anchor="end" dominant-baseline="central">{{ t.v }}</text>
      }
      @for (b of items(); track $index) {
        <rect [attr.x]="b.x" [attr.y]="T" [attr.width]="b.w" [attr.height]="IH" rx="4" class="c-track" />
        @if (b.h > 0) {
          <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="4" class="c-bar">
            <title>{{ b.label }}: {{ b.value }}</title>
          </rect>
        }
        <text [attr.x]="b.x + b.w / 2" [attr.y]="H - 10" class="c-axis" text-anchor="middle">{{ b.label }}</text>
      }
      @if (targetY() !== null) {
        <line [attr.x1]="L" [attr.x2]="w() - R" [attr.y1]="targetY()" [attr.y2]="targetY()" class="c-target" />
      }
    </svg>
  `
})
export class BarChart {
  bars = input.required<ChartPoint[]>();
  max = input(3);
  target = input<number | null>(null);
  ariaLabel = input('Gráfica de barras');

  readonly w = watchWidth();
  readonly H = H; readonly L = L; readonly R = R; readonly T = T; readonly IH = IH;

  ticks = computed(() =>
    Array.from({ length: this.max() + 1 }, (_, v) => ({ v, y: T + IH * (1 - v / this.max()) }))
  );
  items = computed(() => {
    const b = this.bars(), m = this.max(), n = b.length;
    const slot = (this.w() - L - R) / Math.max(n, 1);
    const bw = Math.min(36, slot * 0.6);
    return b.map((d, i) => {
      const h = (IH * Math.min(d.value, m)) / m;
      return { label: d.label, value: d.value, x: L + slot * i + (slot - bw) / 2, w: bw, y: T + IH - h, h };
    });
  });
  targetY = computed(() => {
    const t = this.target();
    return t === null ? null : T + IH * (1 - t / this.max());
  });
}