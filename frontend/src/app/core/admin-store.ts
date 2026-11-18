import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subscription, tap } from 'rxjs';
import { Role } from './auth.service';

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  active: boolean;
  createdAt: string;
  athlete: { id: string; coachId: string | null } | null;
}
export type NewUserRole = 'COACH' | 'PHYSIO' | 'ADMIN';
export interface NewUser { fullName: string; email: string; role: NewUserRole; }

export const ROLE_LABEL: Record<Role, string> = {
  ATHLETE: 'Deportista',
  COACH: 'Entrenador',
  PHYSIO: 'Fisioterapeuta',
  ADMIN: 'Administrador'
};

@Injectable({ providedIn: 'root' })
export class AdminStore {
  private http = inject(HttpClient);
  private loadRequest?: Subscription;

  readonly users = signal<AdminUser[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);

  readonly athletes = computed(() => this.users().filter((u) => u.role === 'ATHLETE'));
  readonly coaches = computed(() => this.users().filter((u) => u.role === 'COACH' && u.active));

  load() {
    this.loadRequest?.unsubscribe();
    this.loading.set(true);
    this.failed.set(false);
    this.loadRequest = this.http.get<AdminUser[]>('/api/admin/users').subscribe({
      next: (u) => { this.users.set(u); this.loading.set(false); },
      error: () => { this.failed.set(true); this.loading.set(false); }
    });
  }

  reset() {
    this.loadRequest?.unsubscribe();
    this.users.set([]);
    this.loading.set(true);
    this.failed.set(false);
  }

  create(body: NewUser): Observable<{ user: AdminUser; tempPassword: string }> {
    return this.http.post<{ user: AdminUser; tempPassword: string }>('/api/admin/users', body).pipe(
      tap((r) => this.users.update((list) => [r.user, ...list]))
    );
  }

  remove(id: string): Observable<unknown> {
    return this.http.delete(`/api/admin/users/${id}`).pipe(
      tap(() => this.users.update((list) => list.filter((u) => u.id !== id)))
    );
  }

  update(id: string, body: Partial<NewUser> & { active?: boolean }): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`/api/admin/users/${id}`, body).pipe(
      tap(user => this.users.update(list => list.map(row => row.id === id ? user : row)))
    );
  }

  setCoach(athleteId: string, coachId: string | null): Observable<unknown> {
    return this.http.patch(`/api/admin/athletes/${athleteId}/coach`, { coachId }).pipe(
      tap(() => this.users.update(list => list.map(user =>
        user.athlete?.id === athleteId ? { ...user, athlete: { id: athleteId, coachId } } : user
      )))
    );
  }
}
