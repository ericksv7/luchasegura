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
export type EvaluationPhase = 'INITIAL' | 'FINAL';
export type EvaluationInstrument = 'SEBT' | 'YBT' | 'T_TEST' | 'FMS' | 'LESS' | 'BASELINE';
export interface EvaluationMeasurement { value: number; side?: 'LEFT' | 'RIGHT'; direction?: string; }
export interface EvaluationRevision {
  measuredOn: string; result: unknown; version: number; recordedAt: string;
  observations: string | null; author: { id: string; fullName: string };
}
export interface FunctionalEvaluation {
  id: string; testType: string; phase: EvaluationPhase; result: unknown; measuredAt?: string;
  measuredOn: string | null; version?: number; observations?: string | null;
  author?: EvaluationRevision['author'] | null;
  program: { id: string; name: string } | null; interventionStartedAt: string | null;
}
export interface EvaluationIntervention { programId: string; startedAt: string; }
export interface EvaluationHistory {
  intervention?: EvaluationIntervention | null; tests: FunctionalEvaluation[];
}
export type StructuredAssessment =
  | { version: 'FMS-COOK-2014'; patterns: { scores: (number | null)[]; clearing: (boolean | null)[] }[] }
  | { version: 'LESS-17-MEAN3'; trials: (number | null)[][] };

export interface EvaluationBaseline {
  version: 'WEEK0-V1'; age: number | null; weight: number | null; category: string | null;
  experience: number | null; style: string | null; historyReviewed: boolean;
}
export interface EvaluationWrite {
  operationId: string; measuredOn: string; measurements?: EvaluationMeasurement[]; assessment?: StructuredAssessment; baseline?: EvaluationBaseline; protocol?: string | null; observations: string | null;
}

@Injectable({ providedIn: 'root' })
export class TeamAthleteApi {
  private http = inject(HttpClient);
  detail(id: string) { return this.http.get<AthleteDetail>(`/api/team/athletes/${id}`); }
  evaluations(id: string) { return this.http.get<EvaluationHistory>(`/api/team/athletes/${id}/evaluations`); }
  ownEvaluations() { return this.http.get<EvaluationHistory>('/api/athletes/me/evaluations'); }
  evaluationRevisions(id: string, testId: string) {
    return this.http.get<EvaluationRevision[]>(`/api/team/athletes/${id}/evaluations/${testId}/revisions`);
  }
  createEvaluation(id: string, data: EvaluationWrite & { instrument: EvaluationInstrument; phase: EvaluationPhase; intervention: EvaluationIntervention }) {
    return this.http.post(`/api/team/athletes/${id}/evaluations`, data);
  }
  updateEvaluation(id: string, testId: string, data: EvaluationWrite & { expectedVersion: number }) {
    return this.http.patch(`/api/team/athletes/${id}/evaluations/${testId}`, data);
  }
  setProgramStart(id: string, startedAt: string, expectedStartedAt: string | null) {
    return this.http.patch<{ startedAt: string }>(`/api/team/athletes/${id}/program-start`, { startedAt, expectedStartedAt });
  }
}
