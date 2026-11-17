import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injury } from './athlete-store';

export type AlertStatus = 'NEW' | 'IN_REVIEW' | 'REVIEWED' | 'FOLLOW_UP_PENDING';
export const ALERT_LABEL: Record<AlertStatus, string> = {
  NEW: 'Pendiente de revisión', IN_REVIEW: 'En revisión',
  REVIEWED: 'Revisión registrada', FOLLOW_UP_PENDING: 'Seguimiento pendiente'
};
export const ALERT_ACTION: Record<AlertStatus, string> = {
  NEW: 'Abrir revisión', IN_REVIEW: 'Continuar revisión',
  REVIEWED: 'Consultar revisión', FOLLOW_UP_PENDING: 'Registrar seguimiento'
};
export const isPendingReview = (status: AlertStatus) => status === 'NEW' || status === 'IN_REVIEW';

export interface AlertEntry {
  id: string; kind: 'START' | 'REOPEN' | 'REVIEW'; version: number;
  authorId: string; authorName: string; createdAt: string;
  previousStatus: AlertStatus; status: AlertStatus;
  observations: string; findings: string | null; actionTaken: string | null;
  recommendations: string | null; referral: string | null;
  followUpRequired: boolean; followUpDate: string | null;
}
export interface ReviewAlert {
  id: string; status: AlertStatus; createdAt: string; athleteId: string; athleteName: string;
  zone: string; intensity: number | null; limitation: Injury['limitation'];
  whenOccurs: string | null; occurredAt: string; followUpDate: string | null;
}
export interface AlertDetail {
  alert: { id: string; status: AlertStatus; version: number; createdAt: string; entries: AlertEntry[] };
  athlete: { id: string; name: string };
  report: Injury & { mechanism: string | null };
  history: (Injury & { alerts: { id: string; status: AlertStatus; entries: AlertEntry[] }[] })[];
}
export type ReviewPayload = {
  kind: 'REVIEW'; observations: string; findings: string; actionTaken: string;
  recommendations: string; referral: string; followUpRequired: boolean; followUpDate: string | null;
} | { kind: 'START' } | { kind: 'REOPEN'; observations: string };

@Injectable({ providedIn: 'root' })
export class AlertApi {
  private http = inject(HttpClient);
  list(status = 'PENDING', athleteId: string | null = null) {
    let params = new HttpParams().set('status', status);
    if (athleteId) params = params.set('athleteId', athleteId);
    return this.http.get<ReviewAlert[]>('/api/team/alerts', { params });
  }
  detail(id: string) { return this.http.get<AlertDetail>(`/api/team/alerts/${id}`); }
  record(id: string, body: ReviewPayload & { requestId: string; expectedVersion: number }) {
    return this.http.post<AlertEntry>(`/api/team/alerts/${id}/review`, body);
  }
}
