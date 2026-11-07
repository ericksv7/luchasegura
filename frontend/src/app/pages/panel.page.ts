import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { StateView } from '../core/state';

interface Me { id: string; email: string; fullName: string; role: string; }
const ROLES: Record<string, string> = {
  ATHLETE: 'Deportista', COACH: 'Entrenador', PHYSIO: 'Fisioterapeuta', ADMIN: 'Administrador'
};

// Panel provisional: se reemplaza por las pantallas reales de cada rol
@Component({
  selector: 'app-panel',
  imports: [StateView],
  template: `
    <main class="auth">
      <section class="auth-card" [attr.aria-busy]="loading()">
        <h1>{{ title }}</h1>
        @if (failed()) {
          <app-state kind="error" title="No pudimos cargar tu información"
            text="Revisa tu conexión e inténtalo de nuevo." action="Reintentar" (act)="load()" />
        } @else {
          <p [class.sk]="loading()">{{ loading() ? 'Hola, Nombre Apellido' : 'Hola, ' + me()?.fullName }}</p>
          <p [class.sk]="loading()">{{ loading() ? 'nombre@correo.com' : me()?.email }}</p>
          <p [class.sk]="loading()">{{ loading() ? 'Rol: Fisioterapeuta' : 'Rol: ' + roleLabel() }}</p>
        }
        <button class="btn secondary" type="button" (click)="auth.logout()">Cerrar sesión</button>
      </section>
    </main>
  `
})
export class PanelPage {
  auth = inject(AuthService);
  private http = inject(HttpClient);
  title = inject(ActivatedRoute).snapshot.data['title'];

  me = signal<Me | null>(null);
  loading = signal(true);
  failed = signal(false);

  constructor() { this.load(); }

  roleLabel() { return ROLES[this.me()?.role ?? ''] ?? ''; }

  load() {
    this.loading.set(true);
    this.failed.set(false);
    this.http.get<Me>('/api/auth/me').subscribe({
      next: (m) => { this.me.set(m); this.loading.set(false); },
      error: () => { this.failed.set(true); this.loading.set(false); }
    });
  }
}