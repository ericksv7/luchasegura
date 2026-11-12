import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, tap } from 'rxjs';
import { apiError } from './auth.service';
import { ChartPoint } from './charts';

export type Limitation = 'NONE' | 'PARTIAL' | 'FULL';

export interface AthleteProfile {
  id: string;
  birthDate: string | null;
  weightKg: string | number | null;
  category: string | null;
  style: string | null;
  yearsExperience: number | null;
  notes: string | null;
}
export interface Injury {
  id: string;
  isHistory: boolean;
  bodyZone: string;
  injuryType: string | null;
  intensity: number | null;
  whenOccurs: string | null;
  limitation: Limitation;
  daysAbsent: number | null;
  recurrent: boolean;
  occurredAt: string;
  notes: string | null;
}
export interface NewInjury {
  isHistory: boolean;
  bodyZone: string;
  injuryType?: string;
  intensity?: number;
  whenOccurs?: string;
  limitation?: Limitation;
  daysAbsent?: number;
  recurrent?: boolean;
  occurredAt?: string;
  notes?: string;
}
export interface ProgramExercise { name: string; component: string; dosage: string | null; description: string | null; }
export interface ProgramSession { id: string; week: number; number: number; minutes: number | null; done: boolean; exercises: ProgramExercise[]; }
export interface ProgramData { id: string; name: string; weeks: number; sessionsPerWeek: number; currentWeek: number; sessions: ProgramSession[]; }

// Opciones de la ficha (propuesta inicial: el equipo de fisioterapia las ajusta)
export const ZONES = ['Cuello', 'Hombro', 'Codo', 'Muñeca o mano', 'Zona dorsal', 'Zona lumbar', 'Cadera', 'Rodilla', 'Tobillo o pie', 'Otra'];
export const WHEN = ['Entrenando', 'Al agarrar o levantar', 'Al competir', 'En reposo', 'Al despertar'];
export const LIMITS: { v: Limitation; label: string }[] = [
  { v: 'NONE', label: 'No' },
  { v: 'PARTIAL', label: 'Parcialmente' },
  { v: 'FULL', label: 'No puedo entrenar' }
];
export const LIMIT_LABEL: Record<Limitation, string> = {
  NONE: 'No limita el entrenamiento',
  PARTIAL: 'Limita parcialmente',
  FULL: 'No puede entrenar'
};
export const PAIN_LABEL = { low: 'Leve', mid: 'Moderado', high: 'Alto' } as const;

export function painLevel(n: number): 'low' | 'mid' | 'high' {
  return n <= 3 ? 'low' : n <= 6 ? 'mid' : 'high';
}
export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}
export function since(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 2_629_800_000);
  if (m < 1) return 'Hace menos de un mes';
  if (m < 12) return `Hace ${m} ${m === 1 ? 'mes' : 'meses'}`;
  const y = Math.floor(m / 12);
  return `Hace ${y} ${y === 1 ? 'año' : 'años'}`;
}
export function componentsOf(s: ProgramSession) {
  return [...new Set(s.exercises.map((e) => e.component))];
}

@Injectable({ providedIn: 'root' })
export class AthleteStore {
  private http = inject(HttpClient);

  readonly profile = signal<AthleteProfile | null>(null);
  readonly injuries = signal<Injury[]>([]);
  readonly program = signal<ProgramData | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);

  readonly sessions = computed(() => this.program()?.sessions ?? []);
  readonly currentWeek = computed(() => this.program()?.currentWeek ?? 1);
  readonly reports = computed(() =>
    this.injuries().filter((i) => !i.isHistory).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  );
  readonly history = computed(() =>
    this.injuries().filter((i) => i.isHistory).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  );
  readonly lastReport = computed(() => {
    const r = this.reports();
    return r.length ? r[r.length - 1] : null;
  });
  readonly zones = computed(() => {
    const seen: string[] = [];
    for (const r of [...this.reports()].reverse()) {
      if (r.intensity !== null && !seen.includes(r.bodyZone)) seen.push(r.bodyZone);
    }
    return seen;
  });
  readonly plannedToDate = computed(() => this.sessions().filter((s) => s.week <= this.currentWeek()).length);
  readonly doneToDate = computed(() => this.sessions().filter((s) => s.week <= this.currentWeek() && s.done).length);
  readonly doneTotal = computed(() => this.sessions().filter((s) => s.done).length);
  readonly compliance = computed(() => {
    const p = this.plannedToDate();
    return p ? Math.round((this.doneToDate() / p) * 100) : 0;
  });
  readonly nextSession = computed(
    () => this.sessions().find((s) => s.week === this.currentWeek() && !s.done) ?? null
  );
  readonly weekBars = computed<ChartPoint[]>(() => {
    const p = this.program();
    if (!p) return [];
    return Array.from({ length: p.weeks }, (_, i) => ({
      label: `S${i + 1}`,
      value: p.sessions.filter((s) => s.week === i + 1 && s.done).length
    }));
  });

  painFor(zone: string | null): ChartPoint[] {
    return this.reports()
      .filter((r) => r.bodyZone === zone && r.intensity !== null)
      .map((r) => ({ label: fmtDate(r.occurredAt), value: r.intensity as number }));
  }

  load() {
    this.loading.set(true);
    this.failed.set(false);
    forkJoin({
      profile: this.http.get<AthleteProfile | null>('/api/athletes/me'),
      injuries: this.http.get<Injury[]>('/api/injuries/mine'),
      program: this.http.get<ProgramData | null>('/api/program/current')
    }).subscribe({
      next: (r) => {
        this.profile.set(r.profile);
        this.injuries.set(r.injuries);
        this.program.set(r.program);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      }
    });
  }

  reset() {
    this.profile.set(null);
    this.injuries.set([]);
    this.program.set(null);
    this.loading.set(true);
    this.failed.set(false);
  }

  saveProfile(body: Record<string, unknown>): Observable<AthleteProfile> {
    return this.http.put<AthleteProfile>('/api/athletes/me', body).pipe(tap((p) => this.profile.set(p)));
  }

  addInjury(body: NewInjury): Observable<Injury> {
    return this.http.post<Injury>('/api/injuries', body).pipe(
      tap((i) => this.injuries.update((list) => [i, ...list]))
    );
  }

  // Cambio inmediato en pantalla; si el servidor falla, se revierte
  toggleSession(id: string, onFail: (msg: string) => void) {
    const current = this.sessions().find((s) => s.id === id);
    if (!current) return;
    const target = !current.done;
    this.setDone(id, target);
    this.http.post<{ done: boolean }>(`/api/program/sessions/${id}/toggle`, {}).subscribe({
      error: (e) => {
        this.setDone(id, !target);
        onFail(apiError(e));
      }
    });
  }

  private setDone(id: string, done: boolean) {
    this.program.update((p) =>
      p ? { ...p, sessions: p.sessions.map((s) => (s.id === id ? { ...s, done } : s)) } : p
    );
  }
}