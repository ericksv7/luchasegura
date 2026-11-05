import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../core/auth.service';

// Panel provisional: se reemplaza por las pantallas reales de cada rol
@Component({
  selector: 'app-panel',
  template: `
    <main class="auth">
      <section class="auth-card">
        <h1>{{ title }}</h1>
        <p>Hola, {{ auth.user()?.fullName }}</p>
        <p>Rol: {{ auth.user()?.role }}. Aquí irá el contenido de este panel.</p>
        <button class="btn" (click)="auth.logout()">Cerrar sesión</button>
      </section>
    </main>
  `
})
export class PanelPage {
  auth = inject(AuthService);
  title = inject(ActivatedRoute).snapshot.data['title'];
}