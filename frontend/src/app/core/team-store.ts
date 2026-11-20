import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AlertDetail, AlertEntry, AlertStatus, isPendingReview } from './alert-api';
import { Limitation } from './athlete-store';
import { bogotaDay } from './civil-date';

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
  followUpAlerts?: number;
  lastReport: { zone: string; intensity: number | null; limitation: Limitation; at: string } | null;
}
export interface TeamAlert {
  followUpDate?: string | null;
  version?: number;
  status: AlertStatus;
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
  stats: { athletes: number; avgCompliance: number; newAlerts: number; followUpAlerts?: number; lowAdherence: number };
  athletes: TeamAthlete[];
  alerts: TeamAlert[];
  followUps?: TeamAlert[];
}

export type Status = 'review' | 'followUp' | 'low' | 'notStarted' | 'ok';
export const STATUS_LABEL: Record<Status, string> = { review: 'Revisar', followUp: 'Seguimiento', low: 'Baja adherencia', notStarted: 'Sin iniciar', ok: 'Al día' };
export const STATUS_BADGE: Record<Status, string> = { review: 'high', followUp: 'mid', low: 'mid', notStarted: 'mid', ok: 'low' };

export function statusOf(a: TeamAthlete): Status {
  return a.newAlerts > 0 ? 'review' : (a.followUpAlerts ?? 0) > 0 ? 'followUp' : a.lowAdherence ? 'low' : a.week === 0 ? 'notStarted' : 'ok';
}
export function ago(iso: string, now = new Date()) {
  const d = (Date.parse(bogotaDay(now)) - Date.parse(bogotaDay(new Date(iso)))) / 86_400_000;
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
  readonly refreshFailed = signal(false);
  private request?: { unsubscribe(): void };
  private receipts = new Map<string, number>();

  readonly athletes = computed(() => this.data()?.athletes ?? []);
  readonly alerts = computed(() => this.data()?.alerts ?? []);
  readonly followUps = computed(() => this.data()?.followUps ?? []);
  readonly stats = computed(() => this.data()?.stats ?? null);
  readonly attention = computed(() =>
    this.athletes()
      .filter((a) => statusOf(a) !== 'ok')
      .sort((a, b) => (statusOf(a) === 'review' ? 0 : 1) - (statusOf(b) === 'review' ? 0 : 1))
  );

  load() {
    // Una respuesta antigua no debe restaurar contadores anteriores al guardado.
    this.request?.unsubscribe();
    this.loading.set(this.data() === null);
    this.failed.set(false); this.refreshFailed.set(false);
    this.request = this.http.get<Overview>('/api/team/overview').subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: () => {
        this.failed.set(this.data() === null); this.refreshFailed.set(this.data() !== null);
        this.loading.set(false);
      }
    });
  }

  // Solo se aplica después de que el backend confirma el registro, nunca de forma optimista.
  recorded(detail: AlertDetail, entry: AlertEntry) {
    const known = this.receipts.get(detail.alert.id) ?? -1;
    if (entry.version <= known) return;
    this.request?.unsubscribe();
    this.receipts.set(detail.alert.id, entry.version);
    this.data.update((data) => {
      if (!data) return data;
      const summary: TeamAlert = {
        id: detail.alert.id, version: entry.version, status: entry.status,
        createdAt: detail.alert.createdAt, athleteId: detail.athlete.id, athleteName: detail.athlete.name,
        zone: detail.report.bodyZone, intensity: detail.report.intensity, limitation: detail.report.limitation,
        whenOccurs: detail.report.whenOccurs, occurredAt: detail.report.occurredAt,
        followUpDate: entry.followUpDate,
      };
      const alerts = data.alerts.filter((a) => a.id !== summary.id);
      const followUps = (data.followUps ?? []).filter((a) => a.id !== summary.id);
      if (isPendingReview(entry.status)) alerts.unshift(summary);
      if (entry.status === 'FOLLOW_UP_PENDING') followUps.unshift(summary);
      return {
        ...data, alerts, followUps,
        stats: { ...data.stats, newAlerts: alerts.length, followUpAlerts: followUps.length },
        athletes: data.athletes.map((a) => ({
          ...a, newAlerts: alerts.filter((x) => x.athleteId === a.id).length,
          followUpAlerts: followUps.filter((x) => x.athleteId === a.id).length,
        })),
      };
    });
  }

  reset() {
    this.request?.unsubscribe(); this.receipts.clear();
    this.data.set(null); this.loading.set(true); this.failed.set(false); this.refreshFailed.set(false);
  }
}
