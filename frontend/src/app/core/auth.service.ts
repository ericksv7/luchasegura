import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Validators } from '@angular/forms';
import { tap } from 'rxjs';

export type Role = 'ATHLETE' | 'COACH' | 'PHYSIO' | 'ADMIN';
export interface SessionUser { id: string; fullName: string; role: Role; mustChangePassword?: boolean; }
interface LoginResponse { token: string; user: SessionUser; }
export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  birthDate: string;
  consent: { textVersion: string; guardianName?: string };
}

export const PASSWORD_VALIDATORS = [
  Validators.required,
  Validators.minLength(10),
  Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/)
];

// La sesión vive en la pestaña (sessionStorage) y se cierra tras 30 minutos sin actividad
export const IDLE_MS = 30 * 60 * 1000;
const TOKEN_KEY = 'ls_token';
const USER_KEY = 'ls_user';
const LAST_KEY = 'ls_last';

const store = {
  get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  del: (k: string) => { try { sessionStorage.removeItem(k); } catch { /* sin almacenamiento */ } }
};

function tokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function apiError(err: any): string {
  if (err?.status === 0) return 'No se pudo conectar con el servidor. Revisa tu conexión.';
  const e = err?.error?.error;
  return typeof e === 'string' ? e : 'Revisa los datos e inténtalo de nuevo.';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly user = signal<SessionUser | null>(this.restore());
  readonly isLoggedIn = computed(() => this.user() !== null);

  get token(): string | null {
    return store.get(TOKEN_KEY);
  }

  // 'token' = venció el token, 'idle' = demasiado tiempo sin actividad, null = sesión vigente
  sessionExpired(): 'token' | 'idle' | null {
    const t = store.get(TOKEN_KEY);
    if (!t) return null;
    if (tokenExpired(t)) return 'token';
    const last = Number(store.get(LAST_KEY)) || 0;
    return Date.now() - last > IDLE_MS ? 'idle' : null;
  }

  markActive() {
    store.set(LAST_KEY, String(Date.now()));
  }

  login(email: string, password: string) {
    return this.http.post<LoginResponse>('/api/auth/login', { email, password }).pipe(tap((r) => this.apply(r)));
  }

  register(data: RegisterData) {
    return this.http.post('/api/auth/register', data);
  }

  forgotPassword(email: string) {
    return this.http.post('/api/auth/forgot-password', { email });
  }

  resetPassword(token: string, password: string) {
    return this.http.post('/api/auth/reset-password', { token, password });
  }

  checkResetToken(token: string) {
    return this.http.get<{ valid: boolean }>('/api/auth/reset-password/check', { params: { token } });
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.http
      .post<LoginResponse>('/api/auth/change-password', { currentPassword, newPassword })
      .pipe(tap((r) => this.apply(r)));
  }

  requirePasswordChange() {
    const u = this.user();
    if (!u) return;
    const next = { ...u, mustChangePassword: true };
    store.set(USER_KEY, JSON.stringify(next));
    this.user.set(next);
    this.router.navigateByUrl('/cambiar-contrasena');
  }

  logout() {
    this.wipe();
    this.user.set(null);
    this.router.navigateByUrl('/login');
  }

  homeFor(role: Role): string {
    if (role === 'ATHLETE') return '/deportista';
    if (role === 'ADMIN') return '/admin';
    return '/equipo';
  }

  private apply(r: LoginResponse) {
    store.set(TOKEN_KEY, r.token);
    store.set(USER_KEY, JSON.stringify(r.user));
    this.markActive();
    this.user.set(r.user);
  }

  private wipe() {
    store.del(TOKEN_KEY);
    store.del(USER_KEY);
    store.del(LAST_KEY);
  }

  private restore(): SessionUser | null {
    // Limpia restos de versiones anteriores, que guardaban la sesión de forma permanente
    try {
      localStorage.removeItem('ls_token');
      localStorage.removeItem('ls_user');
    } catch { /* sin almacenamiento */ }

    if (this.sessionExpired()) {
      this.wipe();
      return null;
    }
    try {
      const raw = store.get(USER_KEY);
      return raw ? (JSON.parse(raw) as SessionUser) : null;
    } catch {
      return null;
    }
  }
}