import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Injury, LIMIT_LABEL, PAIN_LABEL, fmtDate, painLevel, since } from '../core/athlete-store';
import { BarChart, ChartPoint, LineChart, ProgressRing } from '../core/charts';
import { StateView } from '../core/state';

interface Detail {
  id: string;
  name: string;
  email: string;
  coachName: string | null;
  profile: {
    birthDate: string | null;
    weightKg: string | number | null;
    category: string | null;
    style: string | null;
    yearsExperience: number | null;
    notes: string | null;
  };
  program: { weeks: number; sessionsPerWeek: number; currentWeek: number } | null;
  compliance: number;
  planned: number;
  done: number;
  weekBars: { week: number; done: number }[];
  injuries: Injury[];
}

@Component({
  selector: 'app-athlete-detail',
  imports: [RouterLink, ProgressRing, LineChart, BarChart, StateView],
  template: `
    <a class="back" routerLink="/equipo/deportistas">← Deportistas</a>

    @if (failed()) {
      <app-state kind="error" [title]="notFound() ? 'No encontramos a este deportista' : 'No pudimos cargar la ficha'"
        [text]="notFound() ? 'Puede que no esté asignado a tu cuenta.' : 'Revisa tu conexión e inténtalo de nuevo.'"
        [action]="notFound() ? 'Volver a la lista' : 'Reintentar'" (act)="notFound() ? back() : load()" />
    } @else if (loading()) {
      <div class="cards" aria-busy="true" aria-label="Cargando">
        <div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-card"></div>
        <div class="sk sk-chart span-2"></div>
      </div>
    } @else if (d(); as d) {
      <header class="page-head">
        <h1>{{ d.name }}</h1>
        <p class="sub">{{ subtitle() }}</p>
      </header>

      <div class="cards">
        <section class="card" aria-labelledby="d-c">
          <h2 id="d-c">Cumplimiento</h2>
          @if (d.program) {
            <div class="ring-row">
              <app-progress-ring [value]="d.compliance"
                [ariaLabel]="'Cumplimiento del programa: ' + d.compliance + ' por ciento'" />
              <p class="ring-meta"><strong>{{ d.done }} de {{ d.planned }}</strong> sesiones hasta hoy</p>
            </div>
          } @else {
            <p class="meta">No hay un programa asignado.</p>
          }
        </section>

        <section class="card" aria-labelledby="d-r">
          <h2 id="d-r">Resumen</h2>
          <dl class="stats">
            <div><dt>Semana actual</dt><dd>{{ d.program ? d.program.currentWeek : '—' }}</dd></div>
            <div><dt>Reportes de molestias</dt><dd>{{ reports().length }}</dd></div>
            <div><dt>Antecedentes</dt><dd>{{ history().length }}</dd></div>
          </dl>
        </section>

        <section class="card" aria-labelledby="d-g">
          <h2 id="d-g">Datos generales</h2>
          <dl class="rows">
            <div><dt>Edad</dt><dd>{{ age() !== null ? age() + ' años' : 'Sin registrar' }}</dd></div>
            <div><dt>Peso</dt><dd>{{ d.profile.weightKg ? (+d.profile.weightKg) + ' kg' : 'Sin registrar' }}</dd></div>
            <div><dt>Categoría</dt><dd>{{ d.profile.category || 'Sin registrar' }}</dd></div>
            <div><dt>Estilo</dt><dd>{{ d.profile.style || 'Sin registrar' }}</dd></div>
            <div><dt>Experiencia</dt><dd>{{ d.profile.yearsExperience !== null ? d.profile.yearsExperience + ' años' : 'Sin registrar' }}</dd></div>
            <div><dt>Entrenador</dt><dd>{{ d.coachName || 'Sin asignar' }}</dd></div>
          </dl>
        </section>

        <section class="card span-2" aria-labelledby="d-s">
          <h2 id="d-s">Sesiones por semana</h2>
          @if (d.program) {
            <p class="meta">La línea punteada marca la meta de {{ d.program.sessionsPerWeek }} sesiones.</p>
            <app-bar-chart [bars]="bars()" [max]="d.program.sessionsPerWeek" [target]="d.program.sessionsPerWeek"
              ariaLabel="Sesiones completadas por semana del programa" />
          } @else {
            <app-state kind="empty" title="Sin programa asignado" />
          }
        </section>

        <section class="card span-2" aria-labelledby="d-d">
          <h2 id="d-d">Evolución del dolor</h2>
          @if (zones().length) {
            <div class="chips" role="group" aria-label="Zona del cuerpo">
              @for (z of zones(); track z) {
                <button type="button" class="chip" [class.on]="zone() === z" [attr.aria-pressed]="zone() === z"
                  (click)="zoneSel.set(z)">{{ z }}</button>
              }
            </div>
            <app-line-chart [points]="pain()" [max]="10" [ariaLabel]="'Evolución del dolor en ' + zone() + ', de 0 a 10'" />
          } @else {
            <app-state kind="empty" title="Sin reportes de dolor"
              text="Cuando este deportista reporte molestias, verás aquí su evolución." />
          }
        </section>

        <section class="card span-2" aria-labelledby="d-h">
          <h2 id="d-h">Historial</h2>
          @if (d.injuries.length) {
            <ul class="list">
              @for (i of d.injuries; track i.id) {
                <li>
                  <div>
                    <strong>{{ i.bodyZone }}{{ i.injuryType ? ' · ' + i.injuryType : '' }}</strong>
                    <small>
                      {{ i.isHistory ? 'Antecedente · ' + since(i.occurredAt) : date(i.occurredAt) + ' · ' + limit(i.limitation) }}
                    </small>
                  </div>
                  @if (!i.isHistory && i.intensity !== null) {
                    <span [class]="'badge ' + level(i.intensity)">{{ label(i.intensity) }} · {{ i.intensity }}/10</span>
                  } @else if (i.recurrent) {
                    <span class="badge mid">Recurrente</span>
                  }
                </li>
              }
            </ul>
          } @else {
            <app-state kind="empty" title="Sin historial" text="Aún no hay reportes ni antecedentes registrados." />
          }
        </section>
      </div>
    }
  `
})
export class AthleteDetailPage {
  private http = inject(HttpClient);
  private router = inject(Router);
  private id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  d = signal<Detail | null>(null);
  loading = signal(true);
  failed = signal(false);
  notFound = signal(false);
  zoneSel = signal<string | null>(null);

  reports = computed(() =>
    (this.d()?.injuries ?? []).filter((i) => !i.isHistory).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  );
  history = computed(() => (this.d()?.injuries ?? []).filter((i) => i.isHistory));
  zones = computed(() => {
    const seen: string[] = [];
    for (const r of [...this.reports()].reverse()) {
      if (r.intensity !== null && !seen.includes(r.bodyZone)) seen.push(r.bodyZone);
    }
    return seen;
  });
  zone = computed(() => this.zoneSel() ?? this.zones()[0] ?? null);
  pain = computed<ChartPoint[]>(() =>
    this.reports()
      .filter((r) => r.bodyZone === this.zone() && r.intensity !== null)
      .map((r) => ({ label: fmtDate(r.occurredAt), value: r.intensity as number }))
  );
  bars = computed<ChartPoint[]>(() => (this.d()?.weekBars ?? []).map((b) => ({ label: `S${b.week}`, value: b.done })));
  subtitle = computed(() => {
    const p = this.d()?.profile;
    return [p?.category, p?.style].filter(Boolean).join(' · ') || (this.d()?.email ?? '');
  });
  age = computed(() => {
    const b = this.d()?.profile.birthDate;
    if (!b) return null;
    const bd = new Date(b), n = new Date();
    let a = n.getFullYear() - bd.getFullYear();
    const m = n.getMonth() - bd.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < bd.getDate())) a--;
    return a;
  });

  level = painLevel;
  label(n: number) { return PAIN_LABEL[painLevel(n)]; }
  limit(l: Injury['limitation']) { return LIMIT_LABEL[l]; }
  date = fmtDate;
  since = since;

  constructor() { this.load(); }

  back() { this.router.navigateByUrl('/equipo/deportistas'); }

  load() {
    this.loading.set(true);
    this.failed.set(false);
    this.notFound.set(false);
    this.http.get<Detail>(`/api/team/athletes/${this.id}`).subscribe({
      next: (d) => { this.d.set(d); this.loading.set(false); },
      error: (e) => {
        this.notFound.set(e?.status === 404);
        this.failed.set(true);
        this.loading.set(false);
      }
    });
  }
}