import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiError } from './auth.service';
import { Limitation } from './athlete-store';

export interface TeamAthlete {
  id: string;
  name: string;
  email: string;
  week: number;
  planned: number;
  done: number;
  compliance: number;
  lowAdherence: boolean;
  newAlerts: number;
  lastReport: { zone: string; intensity: number | null; limitation: Limitation; at: string } | null;
}
export interface TeamAlert {
  id: string;
  createdAt: string;
  athleteId: string;
  athleteName: string;
  zone: string;
  intensity: number | null;
  limitation: Limitation;
  whenOccurs: string | null;
  occurredAt: string;
}
export interface Overview {
  stats: { athletes: number; avgCompliance: number; newAlerts: number; lowAdherence: number };
  athletes: TeamAthlete[];
  alerts: TeamAlert[];
}

export type Status = 'review' | 'low' | 'ok';
export const STATUS_LABEL: Record<Status, string> = { review: 'Revisar', low: 'Baja adherencia', ok: 'Al día' };
export const STATUS_BADGE: Record<Status, string> = { review: 'high', low: 'mid', ok: 'low' };

export function statusOf(a: TeamAthlete): Status {
  return a.newAlerts > 0 ? 'review' : a.lowAdherence ? 'low' : 'ok';
}
export function ago(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d <= 0) return 'Hoy';
  if (d === 1) return 'Ayer';
  return `Hace ${d} días`;
}
export function initialsOf(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

@Injectable({ providedIn: 'root' })
export class TeamStore {
  private http = inject(HttpClient);

  readonly data = signal<Overview | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);

  readonly athletes = computed(() => this.data()?.athletes ?? []);
  readonly alerts = computed(() => this.data()?.alerts ?? []);
  readonly stats = computed(() => this.data()?.stats ?? null);
  readonly attention = computed(() =>
    this.athletes()
      .filter((a) => statusOf(a) !== 'ok')
      .sort((a, b) => (statusOf(a) === 'review' ? 0 : 1) - (statusOf(b) === 'review' ? 0 : 1))
  );

  load() {
    this.loading.set(true);
    this.failed.set(false);
    this.http.get<Overview>('/api/team/overview').subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: () => { this.failed.set(true); this.loading.set(false); }
    });
  }

  reset() {
    this.data.set(null);
    this.loading.set(true);
    this.failed.set(false);
  }

  // Cambio inmediato en pantalla; si el servidor falla, se revierte
  review(id: string, onFail: (msg: string) => void) {
    const prev = this.data();
    const alert = prev?.alerts.find((a) => a.id === id);
    if (!prev || !alert) return;
    this.data.set({
      stats: { ...prev.stats, newAlerts: Math.max(0, prev.stats.newAlerts - 1) },
      alerts: prev.alerts.filter((a) => a.id !== id),
      athletes: prev.athletes.map((a) =>
        a.id === alert.athleteId ? { ...a, newAlerts: Math.max(0, a.newAlerts - 1) } : a
      )
    });
    this.http.post(`/api/team/alerts/${id}/review`, {}).subscribe({
      error: (e) => { this.data.set(prev); onFail(apiError(e)); }
    });
  }
}