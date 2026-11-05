import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';

export type Role = 'ATHLETE' | 'COACH' | 'PHYSIO' | 'ADMIN';
export interface SessionUser { id: string; fullName: string; role: Role; }
interface LoginResponse { token: string; user: SessionUser; }
export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  consent: { textVersion: string; guardianName?: string };
}

const TOKEN_KEY = 'ls_token';
const USER_KEY = 'ls_user';

export function apiError(err: any): string {
  const e = err?.error?.error;
  return typeof e === 'string' ? e : 'Revisa los datos e inténtalo de nuevo.';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly user = signal<SessionUser | null>(this.read());
  readonly isLoggedIn = computed(() => this.user() !== null);

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  login(email: string, password: string) {
    return this.http.post<LoginResponse>('/api/auth/login', { email, password }).pipe(
      tap((r) => {
        localStorage.setItem(TOKEN_KEY, r.token);
        localStorage.setItem(USER_KEY, JSON.stringify(r.user));
        this.user.set(r.user);
      })
    );
  }

  register(data: RegisterData) {
    return this.http.post('/api/auth/register', data);
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.user.set(null);
    this.router.navigateByUrl('/login');
  }

  homeFor(role: Role): string {
    if (role === 'ATHLETE') return '/deportista';
    if (role === 'ADMIN') return '/admin';
    return '/equipo';
  }

  private read(): SessionUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as SessionUser) : null;
    } catch {
      return null;
    }
  }
}