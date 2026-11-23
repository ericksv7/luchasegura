import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export const restLabels = {
  VERY_RESTFUL: 'Muy reparador', RESTFUL: 'Reparador', FAIR: 'Regular',
  LITTLE_REST: 'Poco reparador', NO_REST: 'Nada reparador',
};
export const fatigueLabels = {
  NONE: 'Ninguna', MILD: 'Leve', MODERATE: 'Moderada', HIGH: 'Alta', VERY_HIGH: 'Muy alta',
};
export const recoveryLabels = {
  VERY_GOOD: 'Muy buena', GOOD: 'Buena', FAIR: 'Regular', LOW: 'Baja', VERY_LOW: 'Muy baja',
};

export interface WellbeingValues {
  sleepHours: number | null;
  rest: keyof typeof restLabels | null;
  fatigue: keyof typeof fatigueLabels | null;
  recovery: keyof typeof recoveryLabels | null;
  notes?: string | null;
}

export interface WellbeingRevision extends WellbeingValues {
  version: number;
  recordedAt: string;
}

export interface WellbeingEntry {
  id: string;
  day: string;
  startedOn: string;
  week: number;
  version: number;
  program: { id: string; name: string };
  current: WellbeingRevision;
}

export interface WellbeingIntervention { programId: string; startedOn: string; endsOn: string; }
export interface WellbeingPageResult {
  entries: WellbeingEntry[];
  nextCursor: string | null;
  intervention?: WellbeingIntervention | null;
  today?: string;
}

@Injectable({ providedIn: 'root' })
export class WellbeingApi {
  private http = inject(HttpClient);
  private own = '/api/athletes/me/wellbeing';

  list(athleteId?: string, cursor?: string) {
    const url = athleteId ? `/api/team/athletes/${encodeURIComponent(athleteId)}/wellbeing` : this.own;
    return this.http.get<WellbeingPageResult>(url, { params: cursor ? { cursor } : {} });
  }

  entry(id: string) { return this.http.get<WellbeingEntry>(`${this.own}/${id}`); }

  history(id: string, before?: number) {
    return this.http.get<{ revisions: WellbeingRevision[]; nextBefore: number | null }>(
      `${this.own}/${id}/revisions`, { params: before ? { before } : {} });
  }

  create(data: WellbeingValues & { day: string; operationId: string; intervention: Omit<WellbeingIntervention, 'endsOn'> }) {
    return this.http.post(this.own, data);
  }

  edit(id: string, data: WellbeingValues & { expectedVersion: number; operationId: string }) {
    return this.http.patch(`${this.own}/${id}`, data);
  }
}
