import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export interface SleepPoint { day: string; week: number; hours: number; }
export interface SleepPeriod { programId: string; name: string; startedOn: string; points: SleepPoint[]; }
export interface SleepCursor { beforeStart: string; beforeProgram: string; }
export interface SleepPage { periods: SleepPeriod[]; next: SleepCursor | null; }
export interface SleepSharingState {
  noticeVersion: string;
  text: string;
  status: 'draft' | 'approved';
  active: boolean;
  coach: { id: string; name: string } | null;
  disabledReason: string | null;
  canRevoke: boolean;
}

@Injectable({ providedIn: 'root' })
export class SleepApi {
  private http = inject(HttpClient);
  private readonly own = '/api/athletes/me/sleep';
  private readonly sharing = this.own + '/sharing';

  list(athleteId?: string, cursor?: SleepCursor) {
    const url = athleteId ? `/api/team/athletes/${encodeURIComponent(athleteId)}/sleep` : this.own;
    return this.http.get<SleepPage>(url, { params: cursor ? { ...cursor } : {} });
  }

  sharingState() { return this.http.get<SleepSharingState>(this.sharing); }

  grant(coachId: string, noticeVersion: string) {
    return this.http.put<void>(this.sharing, { coachId, noticeVersion, accepted: true });
  }

  revoke() { return this.http.delete<void>(this.sharing); }
}
