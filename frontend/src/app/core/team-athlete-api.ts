import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AthleteProfile, Injury, ProgramData } from './athlete-store';

export interface AthleteDetail {
  id: string; name: string; email: string; coachName: string | null;
  profile: Omit<AthleteProfile, 'id'>;
  program: ProgramData | null;
  compliance: number; planned: number; done: number;
  weekBars: { week: number; done: number }[];
  injuries: Injury[];
}
export interface FunctionalEvaluation {
  id: string; testType: string; phase: 'INITIAL' | 'FINAL'; result: unknown;
  measuredAt: string;
}
export interface EvaluationHistory {
  protocolStatus: 'AWAITING_VALIDATION'; dependency: string; tests: FunctionalEvaluation[];
}

@Injectable({ providedIn: 'root' })
export class TeamAthleteApi {
  private http = inject(HttpClient);
  detail(id: string) { return this.http.get<AthleteDetail>(`/api/team/athletes/${id}`); }
  evaluations(id: string) { return this.http.get<EvaluationHistory>(`/api/team/athletes/${id}/evaluations`); }
  setProgramStart(id: string, startedAt: string, expectedStartedAt: string | null) {
    return this.http.patch<{ startedAt: string }>(`/api/team/athletes/${id}/program-start`, { startedAt, expectedStartedAt });
  }
}
